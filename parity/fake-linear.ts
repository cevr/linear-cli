import {
  buildSchema,
  defaultFieldResolver,
  getNamedType,
  graphql,
  isEnumType,
  isListType,
  isNonNullType,
  isScalarType,
} from "graphql";
import type { GraphQLFieldResolver } from "graphql";
import { readFile } from "node:fs/promises";
import type { World } from "./world";

const schema = buildSchema(await readFile(new URL("./schema.graphql", import.meta.url), "utf8"));
export type Failure = "none" | "401" | "500" | "graphql";

export function fakeLinear(w: World, failure: Failure = "none") {
  const mutations: unknown[] = [];
  const requests: { operation: string; authenticated: boolean }[] = [];
  const storageHeaders: boolean[] = [];
  const find = <T extends { id: string }>(items: T[], id: string): T | undefined =>
    items.find((x) => x.id === id);
  const issue = (id: string) => w.issues.find((x) => x.id === id || x.identifier === id);
  const connection = (nodes: unknown[], args: Record<string, any>) => {
    const start = args.after ? Number(String(args.after).replace("cursor-", "")) : 0;
    const end = Math.min(nodes.length, start + Math.min(args.first ?? w.pageSize, w.pageSize));
    return {
      nodes: nodes.slice(start, end),
      pageInfo: {
        hasNextPage: end < nodes.length,
        hasPreviousPage: start > 0,
        startCursor: `cursor-${start}`,
        endCursor: `cursor-${end}`,
      },
    };
  };
  const root = {
    viewer: () => w.user,
    user: ({ id }: { id: string }) => find([w.user], id),
    teams: (args: Record<string, any>) => connection(w.teams, args),
    team: ({ id }: { id: string }) => find(w.teams, id),
    projects: (args: Record<string, any>) => connection(w.projects, args),
    project: ({ id }: { id: string }) => find(w.projects, id),
    issue: ({ id }: { id: string }) => issue(id),
    issues: (args: Record<string, any>) => connection(w.issues, args),
    workflowState: ({ id }: { id: string }) => find(w.states, id),
    comment: ({ id }: { id: string }) => find(w.comments, id),
    issueRelation: ({ id }: { id: string }) => find(w.relations, id),
    issueUpdate: ({ id, input }: { id: string; input: { stateId: string } }) => {
      const target = issue(id);
      if (!target) throw new Error("Issue not found");
      mutations.push({ operation: "issue.update", id: target.id, input });
      const next = find(w.states, input.stateId);
      if (!next) throw new Error("State not found");
      target.state = next;
      return { success: true, issue: target };
    },
    issueCreate: ({ input }: { input: Record<string, any> }) => {
      mutations.push({ operation: "issue.create", input });
      const created = {
        ...w.issues[0]!,
        id: "00000000-0000-4000-8000-000000000099",
        identifier: "ENG-999",
        title: input.title,
        url: "https://linear.app/issue/ENG-999",
      };
      return { success: true, issue: created };
    },
    commentCreate: ({ input }: { input: Record<string, any> }) => {
      mutations.push({ operation: "comment.create", input });
      return { success: true, comment: w.comments[0] };
    },
    issueArchive: ({ id }: { id: string }) => {
      mutations.push({ operation: "issue.archive", id });
      return { success: true, entityId: id };
    },
  };
  const fieldResolver: GraphQLFieldResolver<any, any> = (source, args, context, info) => {
    const name = info.fieldName;
    const parent = info.parentType.name;
    if (parent === "User" && name === "assignedIssues") {
      const type = args.filter?.state?.type?.eq;
      return connection(
        w.issues.filter((x) => !type || x.state.type === type),
        args,
      );
    }
    if (parent === "Team" && name === "states") return connection(w.states, args);
    if (parent === "Issue") {
      if (name === "labels") return connection(w.labels, args);
      if (name === "children")
        return connection(
          w.issues.filter((x) => x.parent?.id === source.id),
          args,
        );
      if (name === "comments") return connection(w.comments, args);
      if (name === "relations")
        return connection(
          w.relations.filter((x) => x.issue?.id === source.id),
          args,
        );
      if (name === "inverseRelations")
        return connection(
          w.relations.filter((x) => x.relatedIssue?.id === source.id),
          args,
        );
    }
    const value = defaultFieldResolver(source, args, context, info);
    if (value !== undefined) return value;
    if (!isNonNullType(info.returnType)) return null;
    const type = info.returnType.ofType;
    if (isListType(type)) return [];
    const named = getNamedType(type);
    if (isEnumType(named)) return named.getValues()[0]!.value;
    if (isScalarType(named)) {
      if (named.name === "Boolean") return false;
      if (["Int", "Float"].includes(named.name)) return 0;
      if (["DateTime", "Date"].includes(named.name)) return "2026-01-01T00:00:00.000Z";
      if (named.name === "JSON") return {};
      return "fixture";
    }
    return {};
  };
  const storage = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      storageHeaders.push(request.headers.has("authorization"));
      const name = new URL(request.url).searchParams.get("name");
      const headers: Record<string, string> = { "Content-Type": "text/plain" };
      if (name === "plain") headers["Content-Disposition"] = 'attachment; filename="Spec.pdf"';
      if (name === "encoded")
        headers["Content-Disposition"] = "attachment; filename*=UTF-8''Men%C3%BA.pdf";
      return new Response("fixture upload\n", { headers });
    },
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/uploads/")) {
        if (url.pathname.endsWith("/missing")) return new Response("missing", { status: 404 });
        requests.push({
          operation: "upload",
          authenticated: request.headers.get("authorization") === "pilot-test-token",
        });
        let disposition = "";
        if (url.pathname.endsWith("/disposition-plain")) disposition = "?name=plain";
        if (url.pathname.endsWith("/disposition-encoded")) disposition = "?name=encoded";
        return new Response(null, {
          status: 302,
          headers: { location: "https://storage.linear-pilot.invalid/object" + disposition },
        });
      }
      if (url.pathname !== "/graphql" || request.method !== "POST")
        return new Response("refused", { status: 403 });
      if (failure === "401")
        return Response.json({ errors: [{ message: "Authentication required" }] }, { status: 401 });
      if (failure === "500")
        return Response.json({ errors: [{ message: "Fixture unavailable" }] }, { status: 500 });
      if (failure === "graphql")
        return Response.json({ errors: [{ message: "Fixture GraphQL failure" }] });
      const body = (await request.json()) as {
        query: string;
        variables?: Record<string, unknown>;
        operationName?: string;
      };
      requests.push({
        operation: body.operationName ?? "document",
        authenticated: request.headers.get("authorization") === "pilot-test-token",
      });
      if (!requests.at(-1)!.authenticated)
        return Response.json({ errors: [{ message: "Authentication required" }] }, { status: 401 });
      const result = await graphql({
        schema,
        source: body.query,
        variableValues: body.variables,
        operationName: body.operationName,
        rootValue: root,
        fieldResolver,
      });
      return Response.json(result);
    },
  });
  return {
    origin: server.url.origin,
    storageOrigin: storage.url.origin,
    mutations,
    requests,
    storageHeaders,
    async close() {
      await server.stop(true);
      await storage.stop(true);
    },
  };
}
