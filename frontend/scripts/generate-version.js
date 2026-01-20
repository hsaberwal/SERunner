/**
 * Generate version.json from git history
 * This runs during build to capture commit info
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

function getGitInfo() {
  // First try Railway environment variables (available in CI)
  const railwayCommit = process.env.RAILWAY_GIT_COMMIT_SHA;
  const railwayBranch = process.env.RAILWAY_GIT_BRANCH;
  const railwayMessage = process.env.RAILWAY_GIT_COMMIT_MESSAGE;
  
  if (railwayCommit) {
    console.log('Using Railway environment variables for version info');
    return {
      version: process.env.npm_package_version || '1.0.0',
      commitHash: railwayCommit.substring(0, 7),
      commitDate: new Date().toISOString(),
      branch: railwayBranch || 'main',
      commits: railwayMessage ? [{
        hash: railwayCommit.substring(0, 7),
        message: railwayMessage,
        date: new Date().toISOString(),
        author: 'Railway Deploy'
      }] : [],
      buildTime: new Date().toISOString(),
      source: 'railway'
    };
  }

  // Try git commands
  try {
    // Get current commit hash (short)
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    
    // Get current commit date
    const commitDate = execSync('git log -1 --format=%ci', { encoding: 'utf-8' }).trim();
    
    // Get branch name
    let branch = 'unknown';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch (e) {
      branch = process.env.GITHUB_REF_NAME || 'main';
    }
    
    // Get last 10 commits with their messages
    const commitLog = execSync(
      'git log -10 --pretty=format:"%h|%s|%ci|%an"',
      { encoding: 'utf-8' }
    ).trim();
    
    const commits = commitLog.split('\n').map(line => {
      const [hash, message, date, author] = line.split('|');
      return {
        hash,
        message,
        date,
        author
      };
    });

    return {
      version: process.env.npm_package_version || '1.0.0',
      commitHash,
      commitDate,
      branch,
      commits,
      buildTime: new Date().toISOString(),
      source: 'git'
    };
  } catch (error) {
    console.warn('Warning: Could not get git info:', error.message);
    return {
      version: process.env.npm_package_version || '1.0.0',
      commitHash: 'dev',
      commitDate: new Date().toISOString(),
      branch: 'local',
      commits: [{
        hash: 'dev',
        message: 'Local development build',
        date: new Date().toISOString(),
        author: 'Developer'
      }],
      buildTime: new Date().toISOString(),
      source: 'fallback'
    };
  }
}

const versionInfo = getGitInfo();
const outputPath = join(publicDir, 'version.json');

writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));
console.log('✅ Generated version.json:', versionInfo.commitHash);
console.log(`   Last commit: ${versionInfo.commits[0]?.message || 'unknown'}`);
