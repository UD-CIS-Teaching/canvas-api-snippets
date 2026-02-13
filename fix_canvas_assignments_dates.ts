const course = ENV.context_asset_string;
const courseId = course.split("_")[1];
const base = ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN;
const api = `${base}/api/v1`;
const courseUrl = `${api}/courses/${courseId}`;
const noApiCourseUrl = `${base}/courses/${courseId}`;


let wait = t => new Promise(s => setTimeout(s, t, t));

// https://stackoverflow.com/questions/8735792/how-to-parse-link-header-from-github-api
let linkParser = (linkHeader)=>{
    let re = /,[\s]*<(.*?)>;[\s]*rel="next"/g;
    let result = re.exec(linkHeader);
    if (result == null) {
        return null;
    }
    return result[1];
}

let DAY_AMOUNT = {'M': 0, 'T': 1, 'W': 2, 'R': 3, 'F': 4, 'S': 5, "U": 6};

// Main
(async function(){    
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
        let next = `${api}/courses/${courseId}/${endpoint}`;
        do {
            let response = await fetch(next+"?"+ new URLSearchParams(parameters));
            all.push(...await response.json());
            let links = response.headers.get('link');
            next = linkParser(links);
        } while (next != null);
        return await all; 
    }

    async function put(courseId, endpoint, parameters) {
        let url = `${api}/courses/${courseId}/${endpoint}`;
        return await $.ajax({ url,
            type: 'PUT',
            data: "" + new URLSearchParams(parameters)
        });
    }
    async function post(courseId, endpoint, parameters) {
        let url = `${api}/courses/${courseId}/${endpoint}`;
        return await $.post(url, parameters);
    }

    let assignments = await getAll(courseId, 'assignments', {});
    await wait(500);
    for (let i = 0; i < assignments.length; i+= 1) {
        let a = assignments[i];
        if (a.unlock_at != null) {
            const date = new Date(a.unlock_at);
            if (date.getDay() === 0) {
                if (date.getHours() === 23 && date.getMinutes() === 59) {
                    const newDate = (new Date(date)).addHours(-23).toISOString().replace('.000', '');
                    await put(courseId, 'assignments/'+a.id, {'assignment[unlock_at]': newDate});
                    console.log(a.name, date, "=>", newDate);
                }
            }
        }
        //await wait(100);
    }

    
})();
