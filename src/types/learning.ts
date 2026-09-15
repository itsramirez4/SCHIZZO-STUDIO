/**
 * A far smaller slice of the pasted "Learning Mode & Tutorials Pro" spec.
 *
 * Dropped entirely: the leaderboard (this is a local single-user desktop app with no accounts
 * or backend — there's no one to rank against, same architectural gap as real-time
 * collaboration), points/XP/levels/streak gamification (decorative for a professional creative
 * tool, and fabricating engagement metrics nobody asked for isn't "learning" — it's noise),
 * achievements/badges (same reasoning), the video player (there's no actual video content to
 * embed — a player pointing at nothing is theater), and "Challenges" with auto-graded success
 * criteria like `recognizable` or `colorCount>=5` — the pasted code's validator is
 * `state[criterion] === true`, which cannot and does not check any of that; nothing in the
 * spec actually computes stroke length, color counts, or image recognizability. Faking that
 * validation would be dishonest, and building the real thing (recognizing a hand-drawn
 * portrait) is a computer-vision problem far outside this feature's scope.
 *
 * What's real and kept: guided Tours (a spotlight overlay stepping through actual, verified
 * UI elements — the same idea as Figma's product tours) and a Documentation panel with
 * genuinely written reference content about this app's real features.
 */

export interface TourStep {
  selector: string;
  title: string;
  description: string;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
}

export interface DocPage {
  id: string;
  title: string;
  category: string;
  content: string[];
}
