/**
 * 环境 URL 配置
 */
export interface EnvironmentUrls {
  postgrest: string;
  auth: string;
}

/**
 * 环境配置映射
 */
const ENV_CONFIGS: Record<'dev' | 'prod', EnvironmentUrls> = {
  dev: {
    // 开发/测试环境：用于浏览器联调的 PostgREST / Auth
    postgrest: 'https://postgrest.sg.seaverse.dev',
    auth: 'https://auth.sg.seaverse.dev',
  },
  prod: {
    postgrest: 'https://db.seaverse.ai',
    auth: 'https://auth.sg.seaverse.dev',
  },
};

/**
 * 获取环境配置
 */
export function getEnvironmentConfig(env: 'dev' | 'prod'): EnvironmentUrls {
  return ENV_CONFIGS[env];
}
