const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();


// 전체 사용자 프로필 조회
router.get('/', async (req, res) => {
  try {
    const userProfiles = await prisma.user_profile.findMany();
    res.json(userProfiles)
  } catch (err) {
    console.error('전체 사용자 프로필 조회 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 특정 사용자 프로필 조회
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const id = parseInt(userId)

  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: '유효하지 않은 userId입니다.' });
  }

  try {
    const userProfile = await prisma.user_profile.findUnique({
      where: {
        user_id: id,
      },
    });

    if (!userProfile) {
      return res.status(404).json({ success: false, message: '사용자 프로필이 없습니다.' });
    }
    res.json(userProfile);
  } catch (err) {
    console.error('특정 사용자 프로필 조회 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 사용자 프로필 생성
router.post('/', async (req, res) => {
  const {
    userId,
    disabilityTypes = [],
    disabilityGrade = '',
    assistiveDevices = [],
    preferredWorkType = [],
    jobInterest = [],
  } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId는 필수입니다.' });
  }

  const id = parseInt(userId);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: '유효하지 않은 userId입니다.' });
  }

  try {

    const newUserProfile = await prisma.user_profile.create({
      data: {
        user_id: id,
        disability_types: Array.isArray(disabilityTypes) ? disabilityTypes.join(',') : '',
        disability_grade: disabilityGrade,
        assistive_devices: Array.isArray(assistiveDevices) ? assistiveDevices.join(',') : '',
        preferred_work_type: Array.isArray(preferredWorkType) ? preferredWorkType.join(',') : '',
        job_interest: Array.isArray(jobInterest) ? jobInterest.join(',') : '',
      }
    });

    res.json({ success: true, id: newUserProfile.id });


  } catch (err) {
    console.error('사용자 프로필 생성 오류:', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: '해당 사용자(user_id)의 프로필이 이미 존재합니다. PUT을 사용해주세요.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// 사용자 프로필 수정/추가
router.put('/', async (req, res) => {
  const {
    userId,
    disabilityTypes = [],
    disabilityGrade = '',
    assistiveDevices = [],
    preferredWorkType = [],
    jobInterest = [],
  } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId는 필수입니다.' });
  }
  const id = parseInt(userId);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: '유효하지 않은 userId입니다.' });
  }

  try {
    await prisma.user_profile.update({
      where: {
        user_id: id,
      },
      data: {
        disability_types: Array.isArray(disabilityTypes) ? disabilityTypes.join(',') : '',
        disability_grade: disabilityGrade,
        assistive_devices: Array.isArray(assistiveDevices) ? assistiveDevices.join(',') : '',
        preferred_work_type: Array.isArray(preferredWorkType) ? preferredWorkType.join(',') : '',
        job_interest: Array.isArray(jobInterest) ? jobInterest.join(',') : '',
      },
    });

    res.json({ success: true, message: '사용자 프로필이 수정되었습니다.' });
  } catch (err) {
    console.error('사용자 프로필 수정 오류:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: '수정할 사용자 프로필이 없습니다. (POST를 사용하여 생성해주세요.)' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;