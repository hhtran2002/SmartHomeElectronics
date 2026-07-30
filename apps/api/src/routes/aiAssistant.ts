import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import multer from 'multer'
import {
  chatAboutProducts,
  findProductsByImage,
  findProductsByMeaning,
} from '../controllers/aiAssistantController.js'
import { aiRateLimit } from '../middleware/aiRateLimit.js'
import { requireAuth } from '../auth.js'

export const aiAssistantRouter = Router()
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
    fields: 3,
  },
})

function uploadSingleImage(request: Request, response: Response, next: NextFunction) {
  imageUpload.single('image')(request, response, (error: unknown) => {
    if (!error) {
      next()
      return
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({ message: 'Ảnh tải lên chỉ được lớn tối đa 8 MB.' })
      return
    }

    response.status(400).json({ message: 'Không thể đọc ảnh tải lên. Vui lòng chọn một file JPEG hoặc PNG.' })
  })
}

aiAssistantRouter.post('/search', aiRateLimit, findProductsByMeaning)
aiAssistantRouter.post('/chat', aiRateLimit, requireAuth, chatAboutProducts)
aiAssistantRouter.post('/image-search', aiRateLimit, requireAuth, uploadSingleImage, findProductsByImage)
