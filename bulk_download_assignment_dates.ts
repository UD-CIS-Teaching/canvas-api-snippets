function getBlockPyUrl(assignment) {
    url = assignment?.external_tool_tag_attributes?.url;
    if (url) {
        const searchParams = new URL(url).searchParams;
        return searchParams.get('assignment_group_url') || "";
    } else {
        return "";
    }
}
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

    //let course = ENV.context_asset_string;
    //let courseId = course.split("_")[1];
    let base = ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN;
    let api = `${base}/api/v1`;
    //let courseUrl = `${api}/courses/${courseId}`;
    //let noApiCourseUrl = `${base}/courses/${courseId}`;


    async function getAll(courseId, endpoint, parameters, attr) {
        let all = [];
        if (parameters === undefined) { parameters = {}; }
        parameters['per_page'] = 100;
        let next = courseId ? `${api}/courses/${courseId}/${endpoint}` : `${api}/${endpoint}`;
        do {
            let response = await fetch(next+"?"+ new URLSearchParams(parameters));
            let data = await response.json();
            if (attr !== undefined) {
                data = data[attr];
            }
            all.push(...data);
            let links = response.headers.get('link');
            next = linkParser(links);
        } while (next != null);
        return await all; 
    }
    
    let courses = [ // Course IDs go here
    ];

    const allAssignments = [];
    for (const course of courses) {
        const assignments = await getAll(course, "assignments", {per_page: 100, "include[]": "all_dates"});
        allAssignments.push(...assignments.filter(
            a => a.published
        ).map(a => {
            a['course_id'] = course;
            return a;
        }))
        console.log(`/${courses.length} courses finished`)
    };
    console.log(allAssignments);

    function extractDates(a) {
        const fallback = [a.unlock_at || "", a.due_at || "", a.lock_at || ""];
        if (!a.all_dates || !a.all_dates.length){
            return fallback;
        }
        const base = a.all_dates.find(o => o.base);
        if (!base) {
            return fallback;
        }
        return [
            base.unlock_at || a.unlock_at || "",
            base.due_at || a.due_at || "",
            base.lock_at || a.lock_at || "",
        ];
    }
    
    const filename = `assignment_dates.csv`;
    let defaultHeaders = ['CanvasCourseId', 'Name', 'Available', 'Due', 'Lock', 'AssignmentGroupId'];
    const csv = [defaultHeaders.join(","),
                 ...allAssignments.map((a => {
        return [a.course_id, a.name,
                ...extractDates(a),
                getBlockPyUrl(a)
               ]
            .map(String)  // convert every value to String
            .map(v => v.replaceAll('"', '""'))  // escape double colons
            .map(v => `"${v}"`)  // quote it
            .join(',');  // comma-separated
    }))].join("\n");
    console.log(csv);
    downloadBlob(csv, filename, "text/csv;charset=utf-8;")
})()                                                                                                                                
