/**
 * 患者管理状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { patientAPI } from '@/utils/request'
import { ElMessage } from 'element-plus'

export const usePatientStore = defineStore('patient', () => {
  // 状态
  const patients = ref([])
  const currentPatient = ref(null)
  const loading = ref(false)
  const searchKeyword = ref('')

  // 计算属性
  const filteredPatients = computed(() => {
    if (!searchKeyword.value) {
      return patients.value
    }

    const keyword = searchKeyword.value.toLowerCase()
    return patients.value.filter(patient =>
      patient.name.toLowerCase().includes(keyword) ||
      patient.phone?.includes(keyword) ||
      patient.id_card?.includes(keyword)
    )
  })

  // 方法
  const fetchPatients = async () => {
    loading.value = true
    try {
      const res = await patientAPI.getList()
      patients.value = res.data || []
      console.log('[Patient Store] 加载患者列表成功，共', patients.value.length, '条数据')
    } catch (error) {
      ElMessage.error('获取患者列表失败')
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  const fetchPatientDetail = async (id) => {
    loading.value = true
    try {
      const res = await patientAPI.getDetail(id)
      currentPatient.value = res.data
      return res.data
    } catch (error) {
      ElMessage.error('获取患者详情失败')
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  const createPatient = async (data) => {
    loading.value = true
    try {
      console.log('[Patient Store] 准备创建患者，发送数据:', data)
      const res = await patientAPI.create(data)
      console.log('[Patient Store] 患者创建成功，后端返回:', res.data)
      patients.value.unshift(res.data)
      ElMessage.success('患者创建成功')
      return res.data
    } catch (error) {
      ElMessage.error('创建患者失败')
      console.error('[Patient Store] 创建患者失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const updatePatient = async (id, data) => {
    loading.value = true
    try {
      const res = await patientAPI.update(id, data)
      const index = patients.value.findIndex(p => p.patient_id === id)
      if (index !== -1) {
        patients.value[index] = res.data
      }
      ElMessage.success('患者信息更新成功')
      return res.data
    } catch (error) {
      ElMessage.error('更新患者信息失败')
      console.error(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const deletePatient = async (id) => {
    loading.value = true
    try {
      await patientAPI.delete(id)
      patients.value = patients.value.filter(p => p.patient_id !== id)
      ElMessage.success('患者删除成功')
    } catch (error) {
      ElMessage.error('删除患者失败')
      console.error(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const setCurrentPatient = (patient) => {
    currentPatient.value = patient
  }

  return {
    patients,
    currentPatient,
    loading,
    searchKeyword,
    filteredPatients,
    fetchPatients,
    fetchPatientDetail,
    createPatient,
    updatePatient,
    deletePatient,
    setCurrentPatient
  }
})
