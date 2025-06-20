import Joi from 'joi';

export const schemas = {
  peerId: Joi.string().alphanum().min(10).max(50).required(),
  roomId: Joi.string().alphanum().min(1).max(50).required(),
  fileHash: Joi.string().hex().length(64).required(),
  
  joinRoom: Joi.object({
    type: Joi.string().valid('join-room').required(),
    roomId: Joi.string().alphanum().min(1).max(50).required(),
    timestamp: Joi.number().integer().positive().required()
  }),
  
  leaveRoom: Joi.object({
    type: Joi.string().valid('leave-room').required(),
    roomId: Joi.string().alphanum().min(1).max(50).required(),
    timestamp: Joi.number().integer().positive().required()
  }),
  
  announceFile: Joi.object({
    type: Joi.string().valid('announce-file').required(),
    roomId: Joi.string().alphanum().min(1).max(50).required(),
    fileInfo: Joi.object({
      name: Joi.string().min(1).max(255).required(),
      size: Joi.number().integer().positive().max(1024 * 1024 * 1024).required(), // 1GB max
      hash: Joi.string().hex().length(64).required(),
      type: Joi.string().max(100).required(),
      chunks: Joi.number().integer().positive().required(),
      checksum: Joi.string().hex().length(64).required(),
      uploadedAt: Joi.number().integer().positive().required()
    }).required(),
    timestamp: Joi.number().integer().positive().required()
  }),
  
  requestFile: Joi.object({
    type: Joi.string().valid('request-file').required(),
    roomId: Joi.string().alphanum().min(1).max(50).required(),
    fileHash: Joi.string().hex().length(64).required(),
    timestamp: Joi.number().integer().positive().required()
  }),
  
  webrtcSignaling: Joi.object({
    type: Joi.string().valid('offer', 'answer', 'ice-candidate').required(),
    targetPeerId: Joi.string().alphanum().min(10).max(50).required(),
    data: Joi.any().required(),
    timestamp: Joi.number().integer().positive().required()
  }),
  
  peerMetadata: Joi.object({
    type: Joi.string().valid('peer-metadata').required(),
    metadata: Joi.object({
      userAgent: Joi.string().max(500).optional(),
      capabilities: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      bandwidth: Joi.number().integer().positive().optional()
    }).required(),
    timestamp: Joi.number().integer().positive().required()
  })
};

export const validateMessage = (message, schema) => {
  const { error, value } = schema.validate(message, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
  }
  
  return value;
};

export const sanitizeString = (str, maxLength = 255) => {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength).replace(/[<>\"'&]/g, '');
};