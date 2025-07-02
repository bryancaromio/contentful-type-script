type GithubEnv = 'main' | 'staging' | 'qa' | 'develop';
type ContentfulEnv = 'master' | 'stage' | 'qa' | 'development';

const GITHUB_TO_CONTENTFUL_ENV_MAP: Record<GithubEnv, ContentfulEnv> = {
  'main': 'master',
  'staging': 'stage',
  'qa': 'qa',
  'develop': 'development'
};

const CONTENTFUL_TO_GITHUB_ENV_MAP: Record<ContentfulEnv, GithubEnv> = {
  'master': 'main',
  'stage': 'staging',
  'qa': 'qa',
  'development': 'develop'
};

const GITHUB_ENV_PROMOTION_PATH: Record<Exclude<GithubEnv, 'main'>, GithubEnv> = {
  'develop': 'qa',
  'qa': 'staging',
  'staging': 'main'
};

/**
 * Converts a GitHub environment name to its corresponding Contentful environment name
 * @param githubEnv - The GitHub environment name
 * @returns The corresponding Contentful environment name
 * @throws {Error} If the GitHub environment name is not recognized
 */
function toContentfulEnv(githubEnv: string): ContentfulEnv {
  if (!isGithubEnv(githubEnv)) {
    throw new Error(`Unrecognized GitHub environment: ${githubEnv}. Valid environments are: ${Object.keys(GITHUB_TO_CONTENTFUL_ENV_MAP).join(', ')}`);
  }
  return GITHUB_TO_CONTENTFUL_ENV_MAP[githubEnv];
}

/**
 * Converts a Contentful environment name to its corresponding GitHub environment name
 * @param contentfulEnv - The Contentful environment name
 * @returns The corresponding GitHub environment name
 * @throws {Error} If the Contentful environment name is not recognized
 */
function toGithubEnv(contentfulEnv: string): GithubEnv {
  if (!isContentfulEnv(contentfulEnv)) {
    throw new Error(`Unrecognized Contentful environment: ${contentfulEnv}. Valid environments are: ${Object.keys(CONTENTFUL_TO_GITHUB_ENV_MAP).join(', ')}`);
  }
  return CONTENTFUL_TO_GITHUB_ENV_MAP[contentfulEnv];
}

/**
 * Gets the target GitHub environment based on the source GitHub environment
 * @param sourceGithubEnv - The source GitHub environment name
 * @returns The target GitHub environment name
 * @throws {Error} If the source environment is not valid or has no target
 */
function getTargetGithubEnv(sourceGithubEnv: string): GithubEnv {
  if (!isGithubEnv(sourceGithubEnv)) {
    throw new Error(`Invalid source environment: ${sourceGithubEnv}. Valid source environments are: ${Object.keys(GITHUB_ENV_PROMOTION_PATH).join(', ')}`);
  }

  if (sourceGithubEnv === 'main') {
    throw new Error('Cannot promote from main environment as it is the highest environment');
  }

  return GITHUB_ENV_PROMOTION_PATH[sourceGithubEnv as Exclude<GithubEnv, 'main'>];
}

// Type guards
function isGithubEnv(env: string): env is GithubEnv {
  return Object.keys(GITHUB_TO_CONTENTFUL_ENV_MAP).includes(env);
}

function isContentfulEnv(env: string): env is ContentfulEnv {
  return Object.keys(CONTENTFUL_TO_GITHUB_ENV_MAP).includes(env);
}

export {
  GithubEnv,
  ContentfulEnv,
  toContentfulEnv,
  toGithubEnv,
  getTargetGithubEnv,
  GITHUB_TO_CONTENTFUL_ENV_MAP,
  CONTENTFUL_TO_GITHUB_ENV_MAP,
  GITHUB_ENV_PROMOTION_PATH
}; 