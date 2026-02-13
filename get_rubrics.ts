(async function(){

    // https://stackoverflow.com/questions/8735792/how-to-parse-link-header-from-github-api
    const linkParser = (linkHeader)=>{
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

    const course = ENV.context_asset_string;
    const courseId = course.split("_")[1];
    const base = ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN;
    const api = `${base}/api/v1`;
    const courseUrl = `${api}/courses/${courseId}`;
    const noApiCourseUrl = `${base}/courses/${courseId}`;
    const assignmentId = ENV.ASSIGNMENT_ID || prompt("What assignment ID should I use?");


    // Get all the data at this endpoint
    async function getAll(endpoint, data) {
        if (data === undefined) {
            data = {};
        }
        let all = [];
        let next = courseUrl+endpoint;
        do {
            let response = await fetch(next);
            all.push(...await response.json());
            let links = response.headers.get('link');
            next = linkParser(links);
        } while (next != null);
        return await all; 
    }

    const getNearest = (goal, values) =>
        values.reduce((prev, curr) => Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev);

    let users = await getAll('/users?per_page=100');
    let userMap = Object.fromEntries(users.map(u => [u.id, u]));
    let submissions = await getAll(`/assignments/${assignmentId}/submissions?include[]=assignment&include[]=rubric_assessment&include[]=submission_history&per_page=100`);
    const keeps = ['workflow_state', 'user_id', 'submitted_at',
                   'late', 'score', 'grade', 'grader_id', 
                   'graded_at', 'assignment_id', 'id'];
    let results = submissions.map(submission => {
        if (!(submission.user_id in userMap)) {
            return false;
        }
        const result = {points_possible: submission.assignment.points_possible};
        keeps.forEach(keepKey => { result[keepKey] = submission[keepKey]});
        const rubricMap = {};
        submission.assignment.rubric.forEach(rubricItem => {
            rubricMap[rubricItem.id] = rubricItem;
        });
        if ('rubric_assessment' in submission) {
            result.subscores = Object.fromEntries(
                Object.entries(submission.rubric_assessment)
                      .map(([id, data]) => {
                const rubricData = rubricMap[id];
                ratings = Object.fromEntries(rubricData.ratings.map(rating => {
                    return [rating.points, rating.description];
                }))
                return [rubricData.description, {
                    name: rubricData.description,
                    points: data.points,
                    score: ratings[getNearest(data.points, Object.keys(ratings))],
                    comment: data.comments,
                    points_possible: rubricData.points
                }];
            }));
        } else {
            result.subscores = {};
        }
        return result;
    });
    const headers = new Set();
    results.filter(Boolean).forEach(item => Object.keys(item.subscores).forEach(h => headers.add(h)));
    const defaultHeaders = ["Student", "SID", "Email", "Submitted", "Late", "Grader", "Graded", "Grade", ...headers, "Comments"];
    // TODO: Make sure we have at least one submission so we can get the assignment name!
    const filename = submissions[0].assignment.name + "_RubricScores.csv";
    const csv = [defaultHeaders.join(","),
                 ...results.filter(Boolean).map((sub => {
        console.log(userMap, sub.user_id);
        const user = userMap[sub.user_id];
        const grader = userMap[sub.grader_id];
        const comments = [];
        const items = [];
        headers.forEach(h => {
            if (h in sub.subscores) {
                items.push(sub.subscores[h].score);
                if (sub.subscores[h].comment) {
                    comments.push(`${h}: ${sub.subscores[h].comment}`)
                }
            } else {
                items.push("");
            }
        });
        return [user.sortable_name, user.login_id, user.email,
                sub.submitted_at, sub.late,
                grader?.sortable_name, grader?.graded_at,
                sub.grade, ...items, comments.join("\n---\n")]
            .map(String)  // convert every value to String
            .map(v => v.replaceAll('"', '""'))  // escape double colons
            .map(v => `"${v}"`)  // quote it
            .join(',');  // comma-separated
    }))].join("\n");
    downloadBlob(csv, filename, "text/csv;charset=utf-8;")
    console.log(results);
})()
