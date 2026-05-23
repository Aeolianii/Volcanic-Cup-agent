// ============================================================
// Role & NPC Types
// ============================================================

export interface Role {
  id: string;
  name: string;
  type: "player_role";
  public_identity: string;
  private_background: string;
  public_goal: string;
  secret_goal: string;
  starting_location: string;
  initial_knowledge: string[];
  abilities: Ability[];
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  category: "social" | "combat" | "investigation" | "political" | "resource";
}

export interface NPC {
  id: string;
  name: string;
  public_identity: string;
  personality: string;
  goal: string;
  secret_goal: string;
  memory: string[];
  initial_knowledge: string[];
  knowledge_scope: "limited";
  behavior_style: BehaviorStyle;
}

export interface BehaviorStyle {
  aggression: number;   // 0-100
  caution: number;      // 0-100
  cooperation: number;  // 0-100
  deception: number;    // 0-100
}
