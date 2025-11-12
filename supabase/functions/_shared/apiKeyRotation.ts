/**
 * API Key Rotation 工具
 * 支持定期轮换 API keys 以提高安全性
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * 获取当前活跃的 API key
 */
export async function getActiveApiKey(
  supabase: SupabaseClient,
  keyName: string = 'lovable_api_key'
): Promise<string | null> {
  // 首先尝试从环境变量获取（向后兼容）
  const envKey = Deno.env.get('LOVABLE_API_KEY');
  if (envKey) {
    console.log('[API Key] Using API key from environment variable');
    return envKey;
  }
  
  // 从数据库获取
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('key_value_encrypted, next_rotation_at')
      .eq('key_name', keyName)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.error('[API Key] Failed to fetch from database:', error);
      return null;
    }
    
    // 检查是否需要轮换
    if (data.next_rotation_at) {
      const nextRotation = new Date(data.next_rotation_at);
      const now = new Date();
      
      if (now >= nextRotation) {
        console.warn('[API Key] API key rotation is due, but using current key');
        // 在实际生产环境中，这里应该触发轮换流程
        // 目前先记录警告
      }
    }
    
    // 注意：在实际实现中，key_value_encrypted 需要解密
    // 这里假设已经解密或使用服务端密钥解密
    // 为了简化，我们暂时返回环境变量或提示需要配置
    console.log('[API Key] API key found in database, but decryption not implemented');
    return null;
  } catch (error) {
    console.error('[API Key] Error fetching API key:', error);
    return null;
  }
}

/**
 * 检查并触发 API key 轮换
 */
export async function checkAndRotateApiKey(
  supabase: SupabaseClient,
  keyName: string = 'lovable_api_key'
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, next_rotation_at, rotation_schedule_days')
      .eq('key_name', keyName)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    const now = new Date();
    const nextRotation = data.next_rotation_at ? new Date(data.next_rotation_at) : null;
    
    // 如果到了轮换时间
    if (nextRotation && now >= nextRotation) {
      console.log('[API Key] Rotation due, marking for rotation');
      
      // 更新轮换时间（实际轮换应该由管理员手动执行）
      const scheduleDays = data.rotation_schedule_days || 90;
      const newNextRotation = new Date(now.getTime() + scheduleDays * 24 * 60 * 60 * 1000);
      
      await supabase
        .from('api_keys')
        .update({
          next_rotation_at: newNextRotation.toISOString(),
          last_rotated_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', data.id);
      
      // 在实际生产环境中，这里应该：
      // 1. 创建新的 API key
      // 2. 更新环境变量或配置
      // 3. 禁用旧的 API key
      // 4. 通知管理员
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[API Key] Error checking rotation:', error);
    return false;
  }
}

/**
 * 初始化 API key（首次设置）
 */
export async function initializeApiKey(
  supabase: SupabaseClient,
  keyName: string,
  encryptedKey: string,
  rotationDays: number = 90
): Promise<boolean> {
  try {
    const now = new Date();
    const nextRotation = new Date(now.getTime() + rotationDays * 24 * 60 * 60 * 1000);
    
    const { error } = await supabase
      .from('api_keys')
      .upsert({
        key_name: keyName,
        key_value_encrypted: encryptedKey,
        is_active: true,
        rotation_schedule_days: rotationDays,
        next_rotation_at: nextRotation.toISOString(),
        last_rotated_at: now.toISOString(),
        updated_at: now.toISOString()
      }, {
        onConflict: 'key_name'
      });
    
    if (error) {
      console.error('[API Key] Failed to initialize:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[API Key] Error initializing:', error);
    return false;
  }
}

