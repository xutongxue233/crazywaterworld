import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function directories(root) {
  try {
    return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}

export function wechatUsersDirectory({ env = process.env, home = os.homedir(), platform = process.platform } = {}) {
  if (platform === 'darwin' && !env.APPDATA) {
    const containers = ['com.tencent.xinWeChat', 'com.tencent.WeChat'];
    const roots = containers.map(name => path.join(home, 'Library', 'Containers', name, 'Data', 'Documents', 'app_data', 'radium', 'users'));
    return roots.find(root => fs.existsSync(root)) || roots[0];
  }
  return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Tencent', 'xwechat', 'radium', 'users');
}

export function wechatPackageCandidates(appId, options) {
  const users = wechatUsersDirectory(options);
  const candidates = [];
  for (const user of directories(users)) {
    const root = path.join(users, user, 'applet', 'packages', appId);
    for (const version of directories(root).filter(name => /^\d+$/.test(name))) {
      const file = path.join(root, version, '_src_chunks_.wxapkg');
      if (fs.existsSync(file)) candidates.push({ version: Number(version), file });
    }
  }
  return candidates.sort((left, right) => right.version - left.version).map(entry => entry.file);
}

export function wechatCacheDirectories(appId, options) {
  const users = wechatUsersDirectory(options);
  return directories(users).map(user => path.join(users, user, 'applet', 'local', appId, 'usr', 'gamecaches'));
}

export function wechatConfigCandidates(appId, options) {
  const found = [];
  for (const cache of wechatCacheDirectories(appId, options)) {
    const directory = path.join(cache, 'config_cn');
    try {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.json')) found.push(path.join(directory, entry.name));
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
  }
  return found;
}
