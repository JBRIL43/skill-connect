#!/usr/bin/env python3
"""Static checks across the Dev 1 / Dev 3 seam. No database or credentials needed.

Three things can drift between developers without anything failing loudly:

1. `lib/types/database.ts` is a hand-written mirror of the migrations. If it
   drifts, every type Dev 3 builds on is a lie.
2. `lib/data/supabase/adapter.ts` has only ever run against mock fixtures, so a
   wrong column name is invisible until NEXT_PUBLIC_DATA_SOURCE=supabase.
3. Dev 3's service-role split assumes specific policies do *not* exist. RLS
   denies by returning zero rows rather than erroring, so a wrong assumption
   here looks like "the match engine found nobody", not like a crash.

Run with: npm run check:contracts
"""
import re
import sys

SCHEMA_SQL = open("supabase/migrations/0001_initial_schema.sql").read()
POLICY_SQL = open("supabase/migrations/0002_rls_policies.sql").read()
GRANT_SQL = open("supabase/migrations/0005_column_grants.sql").read()
TS = open("lib/types/database.ts").read()
ADAPTER = open("lib/data/supabase/adapter.ts").read()

TYPE_TO_TABLE = {
    "Profile": "profiles",
    "CompanyProfile": "company_profiles",
    "SkillMatrix": "skill_matrices",
    "SandboxScore": "sandbox_scores",
    "Badge": "badges",
    "RoleSkillTemplate": "role_skill_templates",
    "SmePosting": "sme_postings",
    "Match": "matches",
    "Notification": "notifications",
    "ContinuityBrief": "continuity_briefs",
    "Payment": "payments",
}

failures: list[str] = []


def parse_sql_tables() -> dict[str, dict[str, dict]]:
    tables = {}
    for m in re.finditer(
        r"create table(?:\s+if not exists)?\s+public\.(\w+)\s*\((.*?)\n\);",
        SCHEMA_SQL,
        re.S | re.I,
    ):
        table, body = m.group(1), m.group(2)
        cols = {}
        for raw in body.split("\n"):
            line = raw.strip().rstrip(",")
            low = line.lower()
            if not line or line.startswith("--"):
                continue
            if low.startswith(
                ("primary key", "unique", "constraint", "foreign key", "check")
            ):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            name = parts[0].strip('"')
            if not re.match(r"^[a-z_][a-z0-9_]*$", name):
                continue
            cols[name] = {
                # A primary key is implicitly not null even without the keyword.
                "nullable": "not null" not in low and "primary key" not in low,
                "default": "default" in low,
            }
        tables[table] = cols
    return tables


def check_types(sql_tables) -> None:
    ts_tables = {}
    for m in re.finditer(r"export type (\w+) = \{(.*?)\n\};", TS, re.S):
        table = TYPE_TO_TABLE.get(m.group(1))
        if not table:
            continue
        cols = {}
        for raw in m.group(2).split("\n"):
            line = raw.strip().rstrip(";")
            if not line or line.startswith(("//", "*", "/*")) or ":" not in line:
                continue
            col, _, typ = line.partition(":")
            col = col.strip()
            if re.match(r"^[a-z_][a-z0-9_]*$", col):
                cols[col] = {"nullable": "null" in typ, "type": typ.strip()}
        if cols:
            ts_tables[table] = cols

    missing = sorted(set(TYPE_TO_TABLE.values()) - set(ts_tables))
    if missing:
        failures.append(f"types: no row type found for {', '.join(missing)}")

    checked = 0
    for table in sorted(set(sql_tables) & set(ts_tables)):
        scols, tcols = sql_tables[table], ts_tables[table]
        for col in sorted(set(scols) - set(tcols)):
            failures.append(f"types: {table}.{col} is in the migration but not database.ts")
        for col in sorted(set(tcols) - set(scols)):
            failures.append(f"types: {table}.{col} is in database.ts but not the migration")
        for col in sorted(set(scols) & set(tcols)):
            s, t = scols[col], tcols[col]
            checked += 1
            if s["nullable"] and not t["nullable"]:
                failures.append(
                    f"types: {table}.{col} is nullable in SQL, {t['type']} in database.ts"
                )
            if not s["nullable"] and t["nullable"] and not s["default"]:
                failures.append(
                    f"types: {table}.{col} is not null in SQL, {t['type']} in database.ts"
                )
    print(f"  database.ts vs migration: {len(ts_tables)} tables, {checked} columns")


def check_adapter(sql_tables) -> None:
    chunks = []
    for m in re.finditer(r'\.from\("(\w+)"\)', ADAPTER):
        start = m.end()
        nxt = ADAPTER.find('.from("', start)
        chunks.append(
            (m.group(1), ADAPTER[start : nxt if nxt != -1 else len(ADAPTER)], m.start())
        )

    checked = 0
    for table, chunk, pos in chunks:
        line_no = ADAPTER[:pos].count("\n") + 1
        if table not in sql_tables:
            failures.append(f'adapter: line {line_no} queries "{table}", which does not exist')
            continue
        valid = sql_tables[table]

        refs = set()
        for sel in re.findall(r'\.select\(\s*"([^"]+)"', chunk):
            for part in sel.split(","):
                part = part.strip()
                if part and part != "*" and "(" not in part:
                    refs.add(part.split(":")[0].strip())
        for fn in ("eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "not", "order"):
            refs.update(re.findall(rf'\.{fn}\(\s*"(\w+)"', chunk))
        for conflict in re.findall(r'onConflict:\s*"([^"]+)"', chunk):
            refs.update(c.strip() for c in conflict.split(","))

        for col in sorted(refs):
            checked += 1
            if col not in valid:
                failures.append(f"adapter: line {line_no} references {table}.{col}, which does not exist")

    tables_used = {t for t, _, _ in chunks}
    print(f"  adapter vs migration:     {len(chunks)} queries, {len(tables_used)} tables, {checked} columns")


def check_rls() -> None:
    policies = {}
    for m in re.finditer(
        r'create policy\s+"([^"]+)"\s+on\s+public\.(\w+)\s+for\s+(\w+)', POLICY_SQL, re.I
    ):
        policies.setdefault(m.group(2), {}).setdefault(m.group(3).lower(), []).append(
            m.group(1)
        )

    rls_on = set(
        re.findall(
            r"alter table public\.(\w+)\s+enable row level security",
            SCHEMA_SQL + POLICY_SQL,
            re.I,
        )
    )

    def names(table, cmd):
        got = policies.get(table, {}).get(cmd, [])
        return got + policies.get(table, {}).get("all", [])

    def sme_policy(table, cmd):
        """Any policy on this command that reaches across users to an SME."""
        for m in re.finditer(
            rf'create policy\s+"([^"]+)"\s+on\s+public\.{table}\s+for\s+(?:{cmd}|all)(.*?);',
            POLICY_SQL,
            re.I | re.S,
        ):
            body = m.group(0).lower()
            if "sme" in body or "company" in body or "match" in body:
                return m.group(1)
        return None

    dev3_tables = [
        "profiles", "sandbox_scores", "badges", "role_skill_templates",
        "sme_postings", "matches", "notifications", "continuity_briefs",
        "company_profiles", "skill_matrices",
    ]
    for table in dev3_tables:
        if table not in rls_on:
            failures.append(f"rls: row level security is not enabled on {table}")

    # These four must NOT exist. Each one is why a code path uses the service role.
    if (found := sme_policy("sandbox_scores", "select")):
        failures.append(
            f'rls: sandbox_scores now has an SME select policy ("{found}") — '
            "the match run may no longer need the service role, and lib/matcher/run.ts should be revisited"
        )
    if names("continuity_briefs", "insert") or names("continuity_briefs", "update"):
        failures.append(
            "rls: continuity_briefs now has a write policy — the custom_node_id "
            "write may no longer need the service role"
        )
    if names("notifications", "insert"):
        failures.append(
            "rls: notifications now has an insert policy — the notification check "
            "may no longer need the service role"
        )
    if (found := sme_policy("profiles", "select")):
        failures.append(
            f'rls: profiles now has an SME select policy ("{found}") — the candidate '
            "identity workaround in listCandidateLabelsForPosting can be simplified"
        )

    # These must exist, or a request-scoped operation silently returns nothing.
    required = [
        ("sandbox_scores", "insert"), ("badges", "insert"),
        ("role_skill_templates", "insert"), ("matches", "select"),
        ("matches", "update"), ("notifications", "select"),
        ("notifications", "update"), ("company_profiles", "select"),
        ("company_profiles", "update"),
    ]
    for table, cmd in required:
        if not names(table, cmd):
            failures.append(f"rls: no {cmd} policy on {table}, so the user-client path will find nothing")

    fn = re.search(
        r"create (?:or replace )?function public\.sme_has_match_with.*?as \$\$(.*?)\$\$",
        POLICY_SQL,
        re.S | re.I,
    )
    if not fn or "opt_in_discoverable" not in fn.group(1).lower():
        failures.append(
            "rls: sme_has_match_with() no longer checks opt_in_discoverable, so "
            "opt-out is enforced only in application code"
        )

    print(f"  rls assumptions:          {len(dev3_tables)} tables, 4 denials, {len(required)} grants")


def check_column_grants() -> None:
    """0005 revokes table-wide UPDATE and grants it back column by column.

    RLS filters rows, not columns, so this is invisible to every other check
    here: a session-client write to a non-granted column passes types, passes
    policy, and is refused only by the live database.
    """
    restricted = set(
        re.findall(
            r"revoke update on public\.(\w+) from[^;]*authenticated", GRANT_SQL, re.I
        )
    )
    granted: dict[str, set[str]] = {}
    for m in re.finditer(
        r"grant update\s*\(([^)]+)\)\s*on public\.(\w+) to[^;]*authenticated",
        GRANT_SQL,
        re.I,
    ):
        cols = {c.strip() for c in m.group(1).split(",") if c.strip()}
        granted.setdefault(m.group(2), set()).update(cols)

    # Split the adapter into methods so a write can be attributed to a client.
    methods = []
    starts = [(m.start(), m.group(1)) for m in re.finditer(r"\n  async (\w+)", ADAPTER)]
    for i, (pos, name) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(ADAPTER)
        methods.append((name, pos, ADAPTER[pos:end]))

    checked = 0
    for name, pos, body in methods:
        for um in re.finditer(r"\.update\(\s*\{(.*?)\}\s*\)", body, re.S):
            # The table is whichever .from() most recently preceded this write.
            befores = list(re.finditer(r'\.from\("(\w+)"\)', body[: um.start()]))
            if not befores:
                continue
            table = befores[-1].group(1)
            if table not in restricted:
                continue

            cols = set(re.findall(r"(\w+)\s*:", um.group(1)))
            if not cols:
                continue
            checked += 1

            # Nearest preceding client wins; `client` resolves to its assignment.
            prefix = body[: um.start()]
            uses_elevated = bool(re.search(r"=\s*elevated\(\)|\belevated\(\)", prefix))
            uses_session = bool(re.search(r"=\s*await db\(\)|\(await db\(\)\)", prefix))
            elevated_write = uses_elevated and not uses_session

            allowed = granted.get(table, set())
            forbidden = cols - allowed
            line_no = ADAPTER[: pos + um.start()].count("\n") + 1

            if forbidden and not elevated_write:
                failures.append(
                    f"grants: {name}() at line {line_no} writes "
                    f"{table}.{{{', '.join(sorted(forbidden))}}} on the session client, "
                    f"but 0005 grants authenticated only {{{', '.join(sorted(allowed))}}} — "
                    "this is refused by the live database, use the service role"
                )
            elif not forbidden and elevated_write:
                failures.append(
                    f"grants: {name}() at line {line_no} uses the service role to write "
                    f"{table}.{{{', '.join(sorted(cols))}}}, which authenticated is "
                    "already granted — prefer the session client so RLS still applies"
                )

    print(
        f"  column grants:            {len(restricted)} restricted tables, {checked} writes"
    )


def main() -> int:
    print("Checking the Dev 1 / Dev 3 seam")
    sql_tables = parse_sql_tables()
    check_types(sql_tables)
    check_adapter(sql_tables)
    check_rls()
    check_column_grants()
    print("")

    if failures:
        print(f"{len(failures)} problem(s):")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("All contracts hold.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
