const express    = require('express');
const router     = express.Router();
const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  sendComplaintToDepartment,
} = require('../controllers/departmentController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/',              protect, adminOnly, getDepartments);
router.post('/',             protect, adminOnly, createDepartment);
router.patch('/:id',         protect, adminOnly, updateDepartment);
router.delete('/:id',        protect, adminOnly, deleteDepartment);
router.post('/send-complaint/:issueId', protect, adminOnly, sendComplaintToDepartment);

module.exports = router;
