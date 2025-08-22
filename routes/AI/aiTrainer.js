// JobEumBackend/aiTrainer.js
const axios = require("axios");

async function exportAndTrain(db, pyUrl) {
    // 1) user_profile
    const [profiles] = await db.query(`
    SELECT user_id, disability_types, disability_grade, assistive_devices,
           preferred_work_type, job_interest
    FROM user_profile
  `);

    // 2) user_activity (job 대상만)
    const [acts] = await db.query(`
    SELECT user_id, activity_type, target_id, status
    FROM user_activity
    WHERE activity_type IN ('recent_view_job','bookmark_job','application_status')
  `);

    // 3) job_post (추천에 필요한 JSON 칼럼 포함)
    const [jobs] = await db.query(`
    SELECT id, disability_requirements, personalized
    FROM job_post
    WHERE status = 'active'
  `);

    const payload = {
        user_profiles: profiles,
        user_activities: acts,
        job_posts: jobs,
    };

    const { data } = await axios.post(`${pyUrl}/train`, payload, { timeout: 600000 });
    return data;
}

module.exports = { exportAndTrain };
