import { Schema } from "effect";
import type { Schema as SchemaType } from "effect/Schema";

export const IssueSelector = Schema.String.pipe(Schema.brand("IssueSelector"));
export type IssueSelector = SchemaType.Type<typeof IssueSelector>;

export const UploadUrl = Schema.String.pipe(Schema.brand("UploadUrl"));
export type UploadUrl = SchemaType.Type<typeof UploadUrl>;

export const ViewerStatus = Schema.Struct({
  emoji: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
});
export interface ViewerStatus extends SchemaType.Type<typeof ViewerStatus> {}

export const Viewer = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  admin: Schema.Boolean,
  status: Schema.optional(ViewerStatus),
});
export interface Viewer extends SchemaType.Type<typeof Viewer> {}

export const Team = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
});
export interface Team extends SchemaType.Type<typeof Team> {}

export const Project = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  state: Schema.String,
  url: Schema.String,
});
export interface Project extends SchemaType.Type<typeof Project> {}

export const IssueReference = Schema.Struct({
  id: Schema.String,
  identifier: Schema.String,
  title: Schema.String,
  url: Schema.String,
});
export interface IssueReference extends SchemaType.Type<typeof IssueReference> {}

export const IssueState = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  type: Schema.String,
});
export interface IssueState extends SchemaType.Type<typeof IssueState> {}

export const IssuePriority = Schema.Struct({
  value: Schema.Finite,
  label: Schema.String,
});
export interface IssuePriority extends SchemaType.Type<typeof IssuePriority> {}

export const IssueSummary = Schema.Struct({
  ...IssueReference.fields,
  branchName: Schema.String,
  priority: IssuePriority,
  state: Schema.optional(IssueState),
});
export interface IssueSummary extends SchemaType.Type<typeof IssueSummary> {}

export const IssueTeam = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
});
export interface IssueTeam extends SchemaType.Type<typeof IssueTeam> {}

export const IssueAssignee = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});
export interface IssueAssignee extends SchemaType.Type<typeof IssueAssignee> {}

export const IssueProject = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  url: Schema.String,
});
export interface IssueProject extends SchemaType.Type<typeof IssueProject> {}

export const IssueLabel = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});
export interface IssueLabel extends SchemaType.Type<typeof IssueLabel> {}

export const IssueCommentAuthor = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});
export interface IssueCommentAuthor extends SchemaType.Type<typeof IssueCommentAuthor> {}

export const IssueComment = Schema.Struct({
  id: Schema.String,
  body: Schema.String,
  createdAt: Schema.String,
  url: Schema.String,
  author: Schema.optional(IssueCommentAuthor),
});
export interface IssueComment extends SchemaType.Type<typeof IssueComment> {}

export const IssueRelation = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  direction: Schema.Literals(["outbound", "inbound"]),
  issue: IssueReference,
});
export interface IssueRelation extends SchemaType.Type<typeof IssueRelation> {}

export const IssueDetails = Schema.Struct({
  ...IssueSummary.fields,
  description: Schema.optional(Schema.String),
  team: Schema.optional(IssueTeam),
  assignee: Schema.optional(IssueAssignee),
  project: Schema.optional(IssueProject),
  parent: Schema.optional(IssueReference),
  labels: Schema.Array(IssueLabel),
  children: Schema.optional(Schema.Array(IssueReference)),
  comments: Schema.optional(Schema.Array(IssueComment)),
  relations: Schema.optional(Schema.Array(IssueRelation)),
});
export interface IssueDetails extends SchemaType.Type<typeof IssueDetails> {}

export const StartedIssue = Schema.Struct({
  issue: IssueReference,
  state: IssueState,
  branchName: Schema.String,
});
export interface StartedIssue extends SchemaType.Type<typeof StartedIssue> {}

export const CreatedIssue = Schema.Struct({
  ...IssueReference.fields,
});
export interface CreatedIssue extends SchemaType.Type<typeof CreatedIssue> {}

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

export const IssueFile = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  /** `description`, or the ID of the comment that links the file. */
  source: Schema.String,
});
export interface IssueFile extends SchemaType.Type<typeof IssueFile> {}

export const SavedFile = Schema.Struct({
  url: Schema.String,
  path: Schema.String,
  bytes: Schema.Finite,
  contentType: Schema.optional(Schema.String),
});
export interface SavedFile extends SchemaType.Type<typeof SavedFile> {}

export interface DownloadedFile {
  readonly bytes: Uint8Array;
  readonly contentType?: string;
  /** From the `Content-Disposition` header, when the server sends one. */
  readonly fileName?: string;
}
