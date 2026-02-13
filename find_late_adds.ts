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


    // Get all the students
    async function getAllStudents() {
        let all = [];
        let parameters = {
            "include[]": ["enrollments"]
        };
        let next = courseUrl+'/users/?per_page=100&include[]=enrollments';
        do {
            let response = await fetch(next, parameters);
            all.push(...await response.json());
            let links = response.headers.get('link');
            next = linkParser(links);
        } while (next != null);
        return await all; 
    }

    let students = await getAllStudents();
    const filename = `emails_${courseId}.csv`;
    /*let emails = students.map(async (student) => {
        let details = await fetch(`${api}/users/${student.id}`, {'include[]': 'email'})
        console.log("Finished", details.email);
        return details.email;
    })*/
    let defaultHeaders = ['name', 'cid', 'sid', 'email', 'added'];
    const csv = [defaultHeaders.join(","),
                 ...students.map((user => {
        return [user.sortable_name, user.id, user.login_id, user.email, user.enrollments[0].created_at]
            .map(String)  // convert every value to String
            .map(v => v.replaceAll('"', '""'))  // escape double colons
            .map(v => `"${v}"`)  // quote it
            .join(',');  // comma-separated
    }))].join("\n");
    console.log(csv);
    downloadBlob(csv, filename, "text/csv;charset=utf-8;")
})()
