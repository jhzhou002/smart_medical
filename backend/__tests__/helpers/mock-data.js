/**
 * Mock 数据生成器
 * 提供测试用的模拟数据
 */

/**
 * 创建模拟患者数据
 * @param {Object} overrides - 覆盖默认值的属性
 */
function createMockPatient(overrides = {}) {
  return {
    name: '测试患者',
    age: 45,
    gender: '男',
    first_visit: true,
    ...overrides,
  };
}

/**
 * 创建模拟用户数据
 * @param {Object} overrides - 覆盖默认值的属性
 */
function createMockUser(overrides = {}) {
  return {
    username: 'testuser',
    password: 'Test1234!',
    email: 'test@example.com',
    role: 'doctor',
    ...overrides,
  };
}

/**
 * 创建模拟实验室指标数据
 * @param {Object} overrides - 覆盖默认值的属性
 */
function createMockLabData(overrides = {}) {
  return {
    血常规: {
      白细胞计数: { value: 12.5, unit: '10^9/L', range: '4-10' },
      红细胞计数: { value: 4.2, unit: '10^12/L', range: '3.5-5.5' },
      血红蛋白: { value: 130, unit: 'g/L', range: '120-160' },
    },
    肝功能: {
      ALT: { value: 85, unit: 'U/L', range: '0-40' },
      AST: { value: 72, unit: 'U/L', range: '0-40' },
      总胆红素: { value: 18, unit: 'μmol/L', range: '3.4-20.5' },
    },
    肾功能: {
      肌酐: { value: 95, unit: 'μmol/L', range: '44-133' },
      尿素氮: { value: 6.5, unit: 'mmol/L', range: '2.9-8.2' },
    },
    ...overrides,
  };
}

/**
 * 创建模拟病历摘要
 */
function createMockTextSummary() {
  return '患者男性，45岁，主诉胸痛3天，伴有咳嗽、发热。' +
    '既往有高血压病史5年，规律服用降压药物。' +
    '体格检查：体温38.2°C，血压145/90mmHg，肺部听诊可闻及湿啰音。';
}

/**
 * 创建模拟 CT 分析结果
 */
function createMockCTAnalysis() {
  return '左肺下叶见片状阴影，边缘模糊，密度不均匀，考虑肺部感染。' +
    '右肺未见明显异常。纵隔未见肿大淋巴结。';
}

/**
 * 创建模拟诊断结果
 */
function createMockDiagnosis(overrides = {}) {
  return {
    diagnosis_text: '初步诊断：左肺下叶肺炎',
    evidence_json: {
      key_findings: [
        {
          type: 'text',
          content: '患者主诉胸痛3天，伴咳嗽发热',
          weight: 0.30,
          source: '病历摘要',
        },
        {
          type: 'ct',
          content: '左肺下叶见片状阴影',
          weight: 0.40,
          source: 'CT 影像',
        },
        {
          type: 'lab',
          content: '白细胞计数 12.5 (↑)',
          weight: 0.30,
          source: '实验室指标',
        },
      ],
    },
    confidence: 85.5,
    risk_score: 65.0,
    anomalies: {
      严重: [
        {
          indicator: 'ALT',
          value: 85,
          normal_range: '0-40',
          deviation: 2.25,
          severity: '严重',
        },
      ],
      中度: [],
      轻微: [],
    },
    ...overrides,
  };
}

/**
 * 创建模拟七牛云上传响应
 */
function createMockQiniuResponse(overrides = {}) {
  return {
    hash: 'FmDZwqadA4-ib_15aUpC4Xc6Mx',
    key: 'opentenbase/text/test-image-12345.jpg',
    url: 'https://qiniu.aihubzone.cn/opentenbase/text/test-image-12345.jpg',
    ...overrides,
  };
}

/**
 * 创建模拟 AI 分析响应
 */
function createMockAIResponse(type = 'text') {
  const responses = {
    text: {
      summary: createMockTextSummary(),
      ocrText: '原始 OCR 文本内容...',
    },
    ct: {
      analysis: createMockCTAnalysis(),
    },
    lab: createMockLabData(),
    diagnosis: createMockDiagnosis(),
  };

  return responses[type] || responses.text;
}

module.exports = {
  createMockPatient,
  createMockUser,
  createMockLabData,
  createMockTextSummary,
  createMockCTAnalysis,
  createMockDiagnosis,
  createMockQiniuResponse,
  createMockAIResponse,
};
