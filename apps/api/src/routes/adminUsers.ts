import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  changeUserRoles,
  changeUserStatus,
  createUser,
  listAdminRoles,
  listAdminUsers,
  reviewEmployee,
  saveEmployeeProfile,
} from '../controllers/adminUserController.js'

export const adminUsersRouter = Router()

adminUsersRouter.use(requireAuth, requireRoles(['SystemAdmin']))

adminUsersRouter.get('/roles', listAdminRoles)
adminUsersRouter.get('/', listAdminUsers)
adminUsersRouter.post('/', createUser)
adminUsersRouter.put('/:userId/employee-profile', saveEmployeeProfile)
adminUsersRouter.patch('/:userId/approval', reviewEmployee)
adminUsersRouter.put('/:userId/roles', changeUserRoles)
adminUsersRouter.patch('/:userId/status', changeUserStatus)
