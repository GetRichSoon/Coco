// Who may use which provider credential, as data. Version-controlled: a change here is a reviewed commit, never a runtime
// parameter. DEFAULT DENY: a team, provider or capability that is not listed here is refused (so a brand new team or agent
// inherits nothing). Read by api/_broker.js. See Lounge/ACCESS_BROKER.md for how to add a team.
//
// teams.<team_id>.providers.<provider> = the capabilities that team may use on that provider
// teams.<team_id>.channels.<provider>  = '*' (any connection of that provider) or the exact connection ids it may touch.
//   A job that carries a channel_id (jobs.channel_id) is narrowed further: it may use only the connection named for
//   that channel (the connection id itself, or `yt-<channel_id>`), never a sibling channel.
const AI = { gemini: ['ai_generate'] };
const YT = { youtube: ['token_mint', 'stats', 'publish'] };
const GUM = { gumroad: ['token_mint', 'stats', 'publish'] };

export const ACCESS_POLICY = {
  version: 1,
  environments: ['production', 'preview', 'development'],
  // devices that may speak for a GitHub workflow run (no queue job). The paired cloud worker only.
  workflow_devices: ['cloud-worker-1'],
  // GitHub workflow file -> the team whose rights the run gets. A workflow not listed gets nothing.
  workflows: {
    'youtube-publish.yml': 'youtube', 'youtube-produce.yml': 'youtube', 'youtube-daily.yml': 'youtube', 'youtube-competitors.yml': 'youtube',
    'gumroad-publish.yml': 'ebooks', 'gumroad-daily.yml': 'ebooks',
  },
  teams: {
    youtube: { providers: { ...YT, ...AI }, channels: { youtube: '*' } },
    // the other video / social teams write with Gemini; they hold no publishing credential here
    content: { providers: { ...AI } }, social: { providers: { ...AI } }, instagram: { providers: { ...AI } }, facebook: { providers: { ...AI } },
    comics: { providers: { ...AI } }, courses: { providers: { ...AI } }, marketing: { providers: { ...AI } }, research: { providers: { ...AI } }, strategy: { providers: { ...AI } },
    ebooks: { providers: { ...GUM, ...AI }, channels: { gumroad: '*' } },
    poppy: { providers: { ...GUM, ...AI }, channels: { gumroad: '*' } },
  },
  // anthropic is never granted to a team: it is reachable only through the AI gateway (server code sets via='ai_gateway'; no request field can).
  gateway_only: ['anthropic'],
};
