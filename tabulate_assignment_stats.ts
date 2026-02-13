(async function() {
    
    function startDialog(title, body) {
        if ($('#dialog').length == 0) {
            $(document.body).append('<div title="' + title +
                '" id="dialog"></div>');
        }
        $("#dialog").dialog({
            autoOpen: false,
            show: "blind",
            hide: "explode",
            width: '80%',
            height: document.documentElement.clientHeight - 100
        });
        $("#dialog").dialog("open");
        $('#dialog').html(body);
    }
    startDialog("Assignment Statistics", "Loading submissions");
    
    function stats(arr) {
        // sort array ascending
        const asc = arr.sort((a, b) => a - b);
        const sum = arr => arr.reduce((a, b) => a + b, 0);
        const mean = sum(arr) / arr.length;

        // sample standard deviation
        const mu = mean;
        const diffArr = arr.map(a => (a - mu) ** 2);
        const std = Math.sqrt(sum(diffArr) / (arr.length - 1));

        const quantile = (arr, q) => {
            const sorted = asc;
            const pos = (sorted.length - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (sorted[base + 1] !== undefined) {
                return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
            } else {
                return sorted[base];
            }
        };

        const q25 = quantile(arr, .25);

        const q50 = quantile(arr, .50);

        const q75 = quantile(arr, .75);
        
        const min = asc[0];
        const max = asc[asc.length-1];

        const median = q50;
        return [mean, std, min, q25, median, q75, max];
    }

    async function paginatedGraphql(url, query, getData) {
        const all = [];
        let after = null;
        let page = 0;
        let retries = 3;

        do {
            page += 1;
            const res = (await $.post(url, query));
            if (res.errors) {
                if (retries) {
                    retries -= 1;
                    await new Promise(r => setTimeout(r, 100));
                } else {
                    throw new Error(JSON.stringify(res.errors));
                }
            } else {
                const {nodes, pageInfo} = getData(res.data);
                for (const node of nodes) all.push(node);

                after = pageInfo.endCursor;
                if (!pageInfo.hasNextPage) break;
                query.variables.after = after;

                await new Promise(r => setTimeout(r, 100));
            }
        } while (true);

        return all;
    }

    const submissions = (await paginatedGraphql("https://udel.instructure.com/api/graphql", {
        "query": `query MyQuery($courseId: ID!, $after: String) {
      course(id: $courseId) {
        id
        submissionsConnection(
          first: 100,
          after: $after
        ) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            score
            submissionStatus
            state
            assignment {
              name
              dueAt
              assignmentGroup {
                name
              }
            }
          }
        }
      }
    }
    
    `, variables: {courseId: ENV.COURSE_ID, after: ""}
    }, (data) => data.course.submissionsConnection))
    console.log(submissions);

    let gathered = {};
    submissions.forEach(node => {
        if (!(node.assignment.name in gathered)) {
            gathered[node.assignment.name] = {due: node.assignment.dueAt, missing: 0, submitted: [],
                                             group: node.assignment.assignmentGroup.name};
        }
        const data = gathered[node.assignment.name];
        if (node.assignment.dueAt < data.due) {
            data.due = node.assignment.dueAt;
        }
        if (node.state === "unsubmitted" || node.score === 0) { data.missing += 1 } else {
            data.submitted.push(node.score);
        }
    });
    gathered = Object.entries(gathered).map(([x,y])=>({name: x, ...y}));
    gathered.sort((a, b) => ((a.group+a.name).localeCompare((b.group+b.name))));
    startDialog("Assignment Statistics", `Loaded ${submissions.length}. Now loading assignments.`);

    const TABLE_HEADER = "<table class='table table-bordered table-condensed table-striped'>";
    let table = [`${TABLE_HEADER}
    <tr>
        <th>Group</th>        
        <th>Assignment</th>
        <th>Missing</th>
        <th>Submitted</th>
        <th>Mean</th>
        <th>Std</th>
        <th>Min</th>
        <th>25%</th>
        <th>Median</th>
        <th>75%</th>
        <th>Max</th>
    </tr>`];
    gathered.forEach(g => {
        const gStats = stats(g.submitted).map(l=>Math.round(l*100)/100);
        table.push("<tr>"+[g.group, g.name, g.missing, g.submitted.length, ...gStats].map(s => `<td>${s}</td>`).join("")+"</tr>");
    });

    let gradingStandards = await $.get("https://udel.instructure.com/api/v1/courses/1697956/grading_standards");
    if (gradingStandards.length === 0) {
        gradingStandards = [{name: "A", value: .94}, {name: "A-", value: .90}, {name: "B+", value: .87}, {name: "B", value: .84}, {name: "B-", value: .80}, {name: "C+", value: .77}, {name: "C", value: .74}, {name: "C-", value: .70}, {name: "D+", value: .67}, {name: "D", value: .64}, {name: "D-", value: .61}, {name: "F", value: 0}];
    } else {
        gradingStandards = gradingStandards[0]["grading_scheme"];
    }
    const identifyGrade = (score) => gradingStandards.find(p => p.value <= score).name;
    const grades = (await paginatedGraphql("https://udel.instructure.com/api/graphql", {
        "query": `query MyQuery($courseId: ID!, $after: String) {
      course(id: $courseId) {
        enrollmentsConnection(
          first: 100,
          after: $after
        ) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            grades {
              finalScore
              currentScore
              unpostedFinalScore
              unpostedCurrentScore
            }
            sisRole
          }
        }
      }
    }
    
    `, variables: {courseId: ENV.COURSE_ID, after: ""}
    }, (data) => data.course.enrollmentsConnection))
    gathered = {};
    //let distributions = Object.fromEntries(gradingStandards.map(g => [g.name, 0]));
    grades
        .filter((n => n.sisRole === 'student'))
        .forEach(node => {
        Object.entries(node.grades).forEach(([cat, score]) => {
            if (!(cat in gathered)) {
                gathered[cat] = {name: cat, submitted: [],
                                 dists: Object.fromEntries(gradingStandards.map(g => [g.name, 0]))}
            }
            gathered[cat].submitted.push(score);
            gathered[cat].dists[identifyGrade(score/100)] += 1;
        });
    });
    gathered = Object.entries(gathered).map(([x,y])=>({name: x, ...y}));
    const afterTable = ["<table><tr>"];
    gathered.forEach(g => {
        afterTable.push("<td>");
        const gStats = stats(g.submitted).map(l=>Math.round(l*100)/100);
        table.push("<tr>"+["", "", g.name, g.submitted.length, ...gStats].map(s => `<td>${s}</td>`).join("")+"</tr>");
        afterTable.push(TABLE_HEADER);
        afterTable.push(`<tr><th>${g.name}</th><th></th><th></th></tr>`);
        Object.entries(g.dists).forEach(([r, s]) => {
            const p = Math.round(100*s/g.submitted.length);
            afterTable.push(`<tr><td>${r}</td><td>${s}</td><td>${p}%</td></tr>`);
        });
        afterTable.push("</table></td>");
    });
    afterTable.push("</tr></table>");
    
    table.push(`</table>`);
    startDialog("Assignment Statistics", table.join("") + afterTable.join(""));


// Missing, # Submitted, Mean Submitted Score, Std Submitted Score, Min, Lower Quartile, Median Submitted Score, Upper Quartile, Max
})();
