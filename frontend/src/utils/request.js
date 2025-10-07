import api from './api'

export const patientAPI = {
  create: (data) => api.post('/patients', data),
  getList: (params) => api.get('/patients', { params }),
  getDetail: (id) => api.get(`/patients/${id}`),
  getFull: (id) => api.get(`/patients/${id}/full`),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
  search: (keyword) => api.get(`/patients/search/${keyword}`)
}

export const textAnalysisAPI = {
  upload: (formData) => api.post('/text-analysis/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getList: (patientId) => api.get(`/text-analysis/${patientId}`),
  delete: (textId) => api.delete(`/text-analysis/${textId}`)
}

export const ctAnalysisAPI = {
  upload: (formData) => api.post('/ct-analysis/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getList: (patientId) => api.get(`/ct-analysis/${patientId}`),
  delete: (ctId) => api.delete(`/ct-analysis/${ctId}`)
}

export const labAnalysisAPI = {
  upload: (formData) => api.post('/lab-analysis/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getList: (patientId) => api.get(`/lab-analysis/${patientId}`),
  delete: (labId) => api.delete(`/lab-analysis/${labId}`)
}

export const diagnosisAPI = {
  generate: (patientId) => api.post('/diagnosis/generate', { patient_id: patientId }),
  getList: (patientId) => api.get(`/diagnosis/${patientId}`),
  delete: (diagnosisId) => api.delete(`/diagnosis/${diagnosisId}`)
}

export const multimodalAnalysisAPI = {
  // 智能诊断 - 调用 smart_diagnosis() 存储过程
  smartDiagnosis: (patientId) => api.post('/multimodal-analysis/smart-diagnosis', { patientId }),

  // 异常检测 - 调用 detect_lab_anomaly() 存储过程
  detectAnomaly: (patientId, indicator) => api.get(`/multimodal-analysis/anomaly-detection/${patientId}/${indicator}`),

  // 趋势分析 - 调用 analyze_lab_trend() 存储过程
  analyzeTrend: (patientId, indicator) => api.get(`/multimodal-analysis/trend-analysis/${patientId}/${indicator}`),

  // 多模态综合查询 - 调用 get_multimodal_patient_data() 存储过程
  getPatientData: (patientId) => api.get(`/multimodal-analysis/patient-data/${patientId}`),

  // 综合报告
  getComprehensiveReport: (patientId) => api.get(`/multimodal-analysis/comprehensive-report/${patientId}`)
}

export default {
  patient: patientAPI,
  textAnalysis: textAnalysisAPI,
  ctAnalysis: ctAnalysisAPI,
  labAnalysis: labAnalysisAPI,
  diagnosis: diagnosisAPI,
  multimodalAnalysis: multimodalAnalysisAPI
}
