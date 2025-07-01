const GITHUB_TO_CONTENTFUL_ENV_MAP = {
  'main': 'master',
  'staging': 'stage',
  'qa': 'qa',
  'develop': 'development'
};

const CONTENTFUL_TO_GITHUB_ENV_MAP = {
  'master': 'main',
  'stage': 'staging',
  'qa': 'qa',
  'development': 'develop'
};

const GITHUB_ENV_PROMOTION_PATH = {
  'develop': 'qa',
  'qa': 'staging',
  'staging': 'main'
};

/**
 * Converts a GitHub environment name to its corresponding Contentful environment name
 * @param {string} githubEnv - The GitHub environment name
 * @returns {string} The corresponding Contentful environment name
 * @throws {Error} If the GitHub environment name is not recognized
 */
function toContentfulEnv(githubEnv) {
  const contentfulEnv = GITHUB_TO_CONTENTFUL_ENV_MAP[githubEnv];
  if (!contentfulEnv) {
    throw new Error(`Unrecognized GitHub environment: ${githubEnv}. Valid environments are: ${Object.keys(GITHUB_TO_CONTENTFUL_ENV_MAP).join(', ')}`);
  }
  return contentfulEnv;
}

/**
 * Converts a Contentful environment name to its corresponding GitHub environment name
 * @param {string} contentfulEnv - The Contentful environment name
 * @returns {string} The corresponding GitHub environment name
 * @throws {Error} If the Contentful environment name is not recognized
 */
function toGithubEnv(contentfulEnv) {
  const githubEnv = CONTENTFUL_TO_GITHUB_ENV_MAP[contentfulEnv];
  if (!githubEnv) {
    throw new Error(`Unrecognized Contentful environment: ${contentfulEnv}. Valid environments are: ${Object.keys(CONTENTFUL_TO_GITHUB_ENV_MAP).join(', ')}`);
  }
  return githubEnv;
}

/**
 * Gets the target GitHub environment based on the source GitHub environment
 * @param {string} sourceGithubEnv - The source GitHub environment name
 * @returns {string} The target GitHub environment name
 * @throws {Error} If the source environment is not valid or has no target
 */
function getTargetGithubEnv(sourceGithubEnv) {
  const targetEnv = GITHUB_ENV_PROMOTION_PATH[sourceGithubEnv];
  if (!targetEnv) {
    if (sourceGithubEnv === 'main') {
      throw new Error('Cannot promote from main environment as it is the highest environment');
    }
    throw new Error(`Invalid source environment: ${sourceGithubEnv}. Valid source environments are: ${Object.keys(GITHUB_ENV_PROMOTION_PATH).join(', ')}`);
  }
  return targetEnv;
}

module.exports = {
  toContentfulEnv,
  toGithubEnv,
  getTargetGithubEnv,
  GITHUB_TO_CONTENTFUL_ENV_MAP,
  CONTENTFUL_TO_GITHUB_ENV_MAP,
  GITHUB_ENV_PROMOTION_PATH
}; 