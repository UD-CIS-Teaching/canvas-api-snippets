// Gets grades by student emails for an assignment across multiple canvas courses
(async function(){
    const linkParser = (linkHeader) => {
        if (!linkHeader) return null;
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        return match ? match[1] : null;
    }

    function downloadBlob(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        link.click();
    }

    async function getAllPages(url) {
        let results = [];
        let next = url;
        do {
            const response = await fetch(next);
            results = results.concat(await response.json());
            const links = response.headers.get('link');
            next = linkParser(links);
        } while (next);
        return results;
    }

    // --- BEGIN CONFIG ---
    const base = window.location.origin;
    const api = `${base}/api/v1`;
    const courseIds = []; // Put Course IDs here
        // prompt("Enter Canvas course IDs, separated by commas").split(',').map(x => x.trim());
    const targetAssignmentName = "Exam 2"; // prompt("What is the assignment name?")
    // --- END CONFIG ---

    let rows = [["Email", `${targetAssignmentName} Grade`]];

    for (let courseId of courseIds) {
        console.log(`Processing course: ${courseId}`);
        const courseApi = `${api}/courses/${courseId}`;

        const assignments = await getAllPages(`${courseApi}/assignments?per_page=100&search_term=${encodeURIComponent(targetAssignmentName)}`);
        const targetAssignment = assignments.find(a => a.name.toLowerCase().includes(targetAssignmentName.toLowerCase()));

        if (!targetAssignment) {
            console.warn(`No '${targetAssignmentName}' assignment found in course ${courseId}`);
            continue;
        }

        const users = await getAllPages(`${courseApi}/users?enrollment_type[]=student&per_page=100`);
        const userMap = Object.fromEntries(users.map(u => [u.id, u]));

        const submissions = await getAllPages(`${courseApi}/assignments/${targetAssignment.id}/submissions?per_page=100`);

        submissions.forEach(sub => {
            const user = userMap[sub.user_id];
            if (!user) return;
            rows.push([user.email || "", sub.score ?? ""]);
        });
    }

    const csvContent = rows.map(row => row.map(val => `"${String(val).replaceAll('"', '""')}"`).join(',')).join('\n');
    downloadBlob(csvContent, `${targetAssignmentName}_Grades_Courses.csv`, "text/csv;charset=utf-8;");
})();
