(async function(){

    // https://stackoverflow.com/questions/8735792/how-to-parse-link-header-from-github-api
    let linkParser = (linkHeader)=>{
        let re = /,[\s]*<(.*?)>;[\s]*rel="next"/g;
        let result = re.exec(linkHeader);
        if (result == null) {
            return null;
        }
        return result[1];
    }

    function downloadBlob(content, filename, contentType) {
      // Create a blob
      var blob = new Blob([content], { type: contentType });
      var url = URL.createObjectURL(blob);

      // Create a link to download it
      var pom = document.createElement('a');
      pom.href = url;
      pom.setAttribute('download', filename);
      pom.click();
    }

    let course = ENV.context_asset_string;
    let courseId = course.split("_")[1];
    let base = ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN;
    let api = `${base}/api/v1`;
    let courseUrl = `${api}/courses/${courseId}`;
    let noApiCourseUrl = `${base}/courses/${courseId}`;

    async function getAll(courseId, endpoint, parameters) {
        let all = [];
        if (parameters === undefined) { parameters = {}; }
        parameters['per_page'] = 100;
        let next = courseId ? `${api}/courses/${courseId}/${endpoint}` : `${api}/${endpoint}`;
        do {
            let response = await fetch(next+"?"+ new URLSearchParams(parameters));
            all.push(...await response.json());
            let links = response.headers.get('link');
            next = linkParser(links);
        } while (next != null);
        return await all; 
    }

    let students = await getAll(courseId, 'users', {'include[]': "enrollments"});
    const filename = `emails_${courseId}.csv`;
    let groups = await getAll(courseId, 'groups');
    let groupInfo = {};
    let groupMembership = {};
    for (let i=0; i < groups.length; i += 1) {
        let groupId = groups[i].id;
        groupInfo[groupId] = groups[i];
        let members = await getAll(undefined, `groups/${groupId}/memberships`);
        members.forEach(member => {
            if (!(member.user_id in groupMembership)) {
                groupMembership[member.user_id] = [];
            }
            groupMembership[member.user_id].push(groupInfo[member.group_id]);
        })
    }
    let defaultHeaders = ['name', 'cid', 'sid', 'email', 'type', 'groups'];
    const rawCsvData = students.map((user => {
        let enrollment = user.enrollments.map(e => e.type).join(", ") || "";
        let studentGroups = user.id in groupMembership ? groupMembership[user.id] : [];
        studentGroups = studentGroups.map(g => g.name);
        return [user.sortable_name, user.id, user.login_id, 
                user.email?.toLowerCase(), enrollment, ...studentGroups];
    }));
    rawCsvData.sort((a, b) => a[4].localeCompare(b[4]) || a.at(-1).localeCompare(b.at(-1)));
    const rawCsvStrings = rawCsvData.map(row => {
        return row.map(String)  // convert every value to String
                  .map(v => v.replaceAll('"', '""'))  // escape double colons
                  .map(v => `"${v}"`)  // quote it
                  .join(',')  // comma-separated
    });
    const csv = [defaultHeaders.join(","), ...rawCsvStrings].join("\n");
    downloadBlob(csv, filename, "text/csv;charset=utf-8;")
})()
