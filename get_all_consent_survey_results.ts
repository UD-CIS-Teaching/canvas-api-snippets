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
    
    let allCourses = await getAll(null, "courses");
    // Probably want to change your logic here to whatever courses you are looking for
    allCourses = allCourses.filter(course => 
        course.sis_course_id && 
        (course.sis_course_id.includes("CISC10") || course.sis_course_id === "23F-CISC167-010") && 
        !course.name.includes("Staging") && 
        !course.name.includes("L") && 
        course.sis_course_id !== "23F-CISC108-013" &&
        (course.sis_course_id.includes("24") || course.sis_course_id.includes("23")));
    console.log(allCourses);
    let courses = allCourses.map(course => course.id);

    const allConsenting = [];
    for (const course of courses) {
        const quizzes = await $.get(`${api}/courses/${course}/quizzes`, {per_page: 100, search_term: "Survey 0"});
        if (quizzes.length != 1) {
            console.log("Incorrect number of consent quizzes:", quizzes, course);
        }
        const quizId = quizzes[0].id;
        const subs = await getAll(course, `quizzes/${quizId}/submissions`, {}, 'quiz_submissions');
        let students = await getAll(course, 'users');
        for (const sub of subs) {
            const questions = await $.get(`${api}/quiz_submissions/${sub.id}/questions`);
            for (const question of questions.quiz_submission_questions) {
                const user = students.find(student => student.id === sub.user_id);
                allConsenting.push({sis_id: user.sis_user_id, 
                                    name: user.name, id: user.id,
                                    email: user.email, course, answer: question.correct});
            };
        };
        console.log(`/${courses.length} courses finished`)
    };
    console.log(allConsenting);
    
    
    const allCourseCodes = courses.join("-");
    const filename = `consenting_${allCourseCodes}.csv`;
    let defaultHeaders = ['name', 'id', 'sis', 'email', 'course', 'consenting'];
    const csv = [defaultHeaders.join(","),
                 ...allConsenting.map((user => {
        return [user.name, user.id, user.sis_id, user.email, user.course, user.answer]
            .map(String)  // convert every value to String
            .map(v => v.replaceAll('"', '""'))  // escape double colons
            .map(v => `"${v}"`)  // quote it
            .join(',');  // comma-separated
    }))].join("\n");
    console.log(csv);
    downloadBlob(csv, filename, "text/csv;charset=utf-8;")
})()                                                                                                                                
