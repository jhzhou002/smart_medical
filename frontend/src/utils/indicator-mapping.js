/**
 * 实验室指标映射工具
 * 用于在中文名称和英文缩写之间进行转换
 */

// 中文名称 -> 英文缩写映射表
export const INDICATOR_NAME_TO_CODE = {
  '白细胞计数': 'WBC',
  '红细胞计数': 'RBC',
  '血红蛋白': 'HGB',
  '血小板计数': 'PLT',
  '中性粒细胞百分比': 'NEUT%',
  '淋巴细胞百分比': 'LYMPH%',
  '单核细胞百分比': 'MONO%',
  '嗜酸性粒细胞百分比': 'EOS%',
  '嗜碱性粒细胞百分比': 'BASO%',
  '红细胞压积': 'HCT',
  '平均红细胞体积': 'MCV',
  '平均红细胞血红蛋白含量': 'MCH',
  '平均红细胞血红蛋白浓度': 'MCHC',
  '红细胞分布宽度': 'RDW',
  '血小板平均体积': 'MPV',
  '血小板分布宽度': 'PDW',
  '血小板压积': 'PCT',

  // 生化指标
  '丙氨酸氨基转移酶': 'ALT',
  '天门冬氨酸氨基转移酶': 'AST',
  '碱性磷酸酶': 'ALP',
  '总胆红素': 'TBIL',
  '直接胆红素': 'DBIL',
  '间接胆红素': 'IBIL',
  '总蛋白': 'TP',
  '白蛋白': 'ALB',
  '球蛋白': 'GLB',
  '白球比': 'A/G',
  '尿素氮': 'BUN',
  '肌酐': 'Cr',
  '尿酸': 'UA',
  '葡萄糖': 'GLU',
  '总胆固醇': 'TC',
  '甘油三酯': 'TG',
  '高密度脂蛋白胆固醇': 'HDL-C',
  '低密度脂蛋白胆固醇': 'LDL-C',

  // 电解质
  '钾': 'K',
  '钠': 'Na',
  '氯': 'Cl',
  '钙': 'Ca',
  '磷': 'P',
  '镁': 'Mg',

  // 肿瘤标志物
  '癌胚抗原': 'CEA',
  '甲胎蛋白': 'AFP',
  '糖类抗原125': 'CA125',
  '糖类抗原199': 'CA199',
  '糖类抗原153': 'CA153',
  '前列腺特异性抗原': 'PSA',

  // 凝血功能
  '凝血酶原时间': 'PT',
  '活化部分凝血活酶时间': 'APTT',
  '凝血酶时间': 'TT',
  '纤维蛋白原': 'FIB',
  'D-二聚体': 'D-Dimer',

  // 其他常见指标
  'C反应蛋白': 'CRP',
  '红细胞沉降率': 'ESR',
  '乳酸脱氢酶': 'LDH',
  '肌酸激酶': 'CK',
  '肌酸激酶同工酶': 'CK-MB',
  '肌钙蛋白': 'cTn'
}

// 英文缩写 -> 中文名称映射表（反向映射）
export const INDICATOR_CODE_TO_NAME = Object.fromEntries(
  Object.entries(INDICATOR_NAME_TO_CODE).map(([name, code]) => [code, name])
)

/**
 * 将中文指标名称转换为英文缩写
 * @param {string} chineseName - 中文名称
 * @returns {string} 英文缩写，如果未找到则返回原始名称
 */
export function nameToCode(chineseName) {
  return INDICATOR_NAME_TO_CODE[chineseName] || chineseName
}

/**
 * 将英文缩写转换为中文指标名称
 * @param {string} code - 英文缩写
 * @returns {string} 中文名称，如果未找到则返回原始缩写
 */
export function codeToName(code) {
  return INDICATOR_CODE_TO_NAME[code] || code
}

/**
 * 批量转换：中文名称 -> 英文缩写
 * @param {string[]} chineseNames - 中文名称数组
 * @returns {string[]} 英文缩写数组
 */
export function namesToCodes(chineseNames) {
  return chineseNames.map(nameToCode)
}

/**
 * 批量转换：英文缩写 -> 中文名称
 * @param {string[]} codes - 英文缩写数组
 * @returns {string[]} 中文名称数组
 */
export function codesToNames(codes) {
  return codes.map(codeToName)
}

/**
 * 从实验室数据中提取指标名称列表
 * @param {Object} labData - 实验室数据对象
 * @returns {string[]} 指标名称数组（中文）
 */
export function extractIndicators(labData) {
  if (!labData) return []

  // 格式1: lab_json 格式 (从 AI 识别结果)
  // { "白细胞计数": {abbreviation: "WBC", value: 6.5, ...}, ... }
  if (labData.lab_json) {
    return Object.keys(labData.lab_json).filter(key => !key.startsWith('_'))
  }

  // 格式2: lab_data 格式 (英文缩写)
  // {WBC: 6.5, RBC: 4.5, ...} -> 转换为中文
  if (labData.lab_data) {
    const codes = Object.keys(labData.lab_data)
    return codesToNames(codes)
  }

  return []
}

/**
 * 从实验室数据中提取指标缩写列表
 * @param {Object} labData - 实验室数据对象
 * @returns {string[]} 指标缩写数组（英文）
 */
export function extractIndicatorCodes(labData) {
  const chineseNames = extractIndicators(labData)
  return namesToCodes(chineseNames)
}

/**
 * 检查指标是否在映射表中
 * @param {string} indicator - 指标名称或缩写
 * @returns {boolean} 是否存在
 */
export function isValidIndicator(indicator) {
  return INDICATOR_NAME_TO_CODE[indicator] !== undefined ||
         INDICATOR_CODE_TO_NAME[indicator] !== undefined
}

/**
 * 获取所有支持的指标列表
 * @returns {Object} { names: string[], codes: string[] }
 */
export function getSupportedIndicators() {
  return {
    names: Object.keys(INDICATOR_NAME_TO_CODE),
    codes: Object.keys(INDICATOR_CODE_TO_NAME)
  }
}
