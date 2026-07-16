import { Schema } from "effect";

export const IssueSelector = Schema.String.pipe(Schema.brand("IssueSelector"));
export type IssueSelector = Schema.Schema.Type<typeof IssueSelector>;

export class ViewerStatus extends Schema.Class<ViewerStatus>("ViewerStatus")({
  emoji: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
}) {}

export class Viewer extends Schema.Class<Viewer>("Viewer")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  admin: Schema.Boolean,
  status: Schema.optional(ViewerStatus),
}) {}

export class Team extends Schema.Class<Team>("Team")({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
}) {}

export class Project extends Schema.Class<Project>("Project")({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  state: Schema.String,
  url: Schema.String,
}) {}

export class IssueReference extends Schema.Class<IssueReference>("IssueReference")({
  id: Schema.String,
  identifier: Schema.String,
  title: Schema.String,
  url: Schema.String,
}) {}

export class IssueState extends Schema.Class<IssueState>("IssueState")({
  id: Schema.String,
  name: Schema.String,
  type: Schema.String,
}) {}

export class IssuePriority extends Schema.Class<IssuePriority>("IssuePriority")({
  value: Schema.Number,
  label: Schema.String,
}) {}

export class IssueSummary extends IssueReference.extend<IssueSummary>("IssueSummary")({
  branchName: Schema.String,
  priority: IssuePriority,
  state: Schema.optional(IssueState),
}) {}

export class IssueTeam extends Schema.Class<IssueTeam>("IssueTeam")({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
}) {}

export class IssueAssignee extends Schema.Class<IssueAssignee>("IssueAssignee")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}

export class IssueProject extends Schema.Class<IssueProject>("IssueProject")({
  id: Schema.String,
  name: Schema.String,
  url: Schema.String,
}) {}

export class IssueLabel extends Schema.Class<IssueLabel>("IssueLabel")({
  id: Schema.String,
  name: Schema.String,
}) {}

export class IssueCommentAuthor extends Schema.Class<IssueCommentAuthor>("IssueCommentAuthor")({
  id: Schema.String,
  name: Schema.String,
}) {}

export class IssueComment extends Schema.Class<IssueComment>("IssueComment")({
  id: Schema.String,
  body: Schema.String,
  createdAt: Schema.String,
  url: Schema.String,
  author: Schema.optional(IssueCommentAuthor),
}) {}

export class IssueRelation extends Schema.Class<IssueRelation>("IssueRelation")({
  id: Schema.String,
  type: Schema.String,
  direction: Schema.Literals(["outbound", "inbound"]),
  issue: IssueReference,
}) {}

export class IssueDetails extends IssueSummary.extend<IssueDetails>("IssueDetails")({
  description: Schema.optional(Schema.String),
  team: Schema.optional(IssueTeam),
  assignee: Schema.optional(IssueAssignee),
  project: Schema.optional(IssueProject),
  parent: Schema.optional(IssueReference),
  labels: Schema.Array(IssueLabel),
  children: Schema.optional(Schema.Array(IssueReference)),
  comments: Schema.optional(Schema.Array(IssueComment)),
  relations: Schema.optional(Schema.Array(IssueRelation)),
}) {}

export class StartedIssue extends Schema.Class<StartedIssue>("StartedIssue")({
  issue: IssueReference,
  state: IssueState,
  branchName: Schema.String,
}) {}

export class CreatedIssue extends IssueReference.extend<CreatedIssue>("CreatedIssue")({}) {}

export interface IssueDetailsOptions {
  readonly comments: boolean;
  readonly children: boolean;
  readonly relations: boolean;
}

export interface CreateIssueInput {
  readonly title: string;
  readonly teamId: string;
  readonly description?: string;
  readonly parent?: IssueSelector;
  readonly projectId?: string;
  readonly priority?: number;
}
