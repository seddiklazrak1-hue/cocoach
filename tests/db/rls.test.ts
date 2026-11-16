/**
 * Tests de sécurité de la base : on exécute les VRAIES migrations dans un
 * Postgres embarqué (PGlite, WebAssembly) et on vérifie qu'un coach ne peut ni
 * lire ni modifier les données d'un autre. Aucun réseau, aucun secret : ces
 * tests tournent tels quels dans la CI.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

let db: PGlite;
let coachA: string;
let coachB: string;

/** Exécute `fn` comme le ferait l'API Supabase pour un coach connecté. */
function asCoach<T>(coachId: string, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      coachId,
    ]);
    return fn(tx);
  }) as Promise<T>;
}

/** Exécute `fn` comme un visiteur non connecté. */
function asAnonymous<T>(fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return fn(tx);
  }) as Promise<T>;
}

async function createCoach(email: string, displayName: string) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, { display_name: displayName }],
  );
  return rows[0].id;
}

async function insertGroup(coachId: string, name: string) {
  const { rows } = await asCoach(coachId, (tx) =>
    tx.query<{ id: string }>(
      "insert into groups (name, discipline) values ($1, 'wrestling') returning id",
      [name],
    ),
  );
  return rows[0].id;
}

async function insertAthlete(coachId: string, name: string) {
  const { rows } = await asCoach(coachId, (tx) =>
    tx.query<{ id: string }>(
      "insert into athletes (display_name) values ($1) returning id",
      [name],
    ),
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(read("./supabase-shim.sql"));
  await db.exec(
    read("../../supabase/migrations/20261116000001_initial_schema.sql"),
  );
  await db.exec(
    read("../../supabase/migrations/20261116000003_consent_journal.sql"),
  );
  coachA = await createCoach("coach.a@example.test", "Coach A");
  coachB = await createCoach("coach.b@example.test", "Coach B");
});

describe("inscription", () => {
  it("crée automatiquement le profil coach avec le nom affiché", async () => {
    const { rows } = await asCoach(coachA, (tx) =>
      tx.query<{ display_name: string }>("select display_name from coaches"),
    );
    // Une seule ligne : la sienne, pas celle du coach B.
    expect(rows).toEqual([{ display_name: "Coach A" }]);
  });
});

describe("isolation entre coachs (RLS)", () => {
  let groupA: string;
  let athleteA: string;

  beforeAll(async () => {
    groupA = await insertGroup(coachA, "Lutte adultes lundi");
    athleteA = await insertAthlete(coachA, "Sami");
  });

  it("le coach A voit ses propres données", async () => {
    const { rows } = await asCoach(coachA, (tx) =>
      tx.query("select id from groups"),
    );
    expect(rows).toHaveLength(1);
  });

  it("le coach B ne voit ni les groupes ni les athlètes du coach A", async () => {
    const result = await asCoach(coachB, async (tx) => ({
      groups: (await tx.query("select id from groups")).rows,
      athletes: (await tx.query("select id from athletes")).rows,
      coaches: (await tx.query("select id from coaches")).rows,
    }));
    expect(result.groups).toHaveLength(0);
    expect(result.athletes).toHaveLength(0);
    expect(result.coaches).toEqual([{ id: coachB }]);
  });

  it("le coach B ne peut ni modifier ni supprimer un groupe du coach A", async () => {
    const affected = await asCoach(coachB, async (tx) => ({
      updated: (
        await tx.query("update groups set name = 'piraté' where id = $1", [
          groupA,
        ])
      ).affectedRows,
      deleted: (await tx.query("delete from groups where id = $1", [groupA]))
        .affectedRows,
    }));
    expect(affected).toEqual({ updated: 0, deleted: 0 });

    const { rows } = await asCoach(coachA, (tx) =>
      tx.query<{ name: string }>("select name from groups where id = $1", [
        groupA,
      ]),
    );
    expect(rows[0].name).toBe("Lutte adultes lundi");
  });

  it("le coach B ne peut pas créer une ligne au nom du coach A", async () => {
    await expect(
      asCoach(coachB, (tx) =>
        tx.query(
          "insert into groups (coach_id, name, discipline) values ($1, 'faux', 'mma')",
          [coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("le coach B ne peut pas rattacher son athlète au groupe du coach A", async () => {
    const athleteB = await insertAthlete(coachB, "Lina");
    // La clé étrangère composite (group_id, coach_id) ne trouve pas de groupe
    // appartenant au coach B avec cet id : l'insertion est refusée.
    await expect(
      asCoach(coachB, (tx) =>
        tx.query(
          "insert into athlete_groups (athlete_id, group_id) values ($1, $2)",
          [athleteB, groupA],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("le coach B ne peut pas écrire de métrique sur un athlète du coach A", async () => {
    const groupB = await insertGroup(coachB, "MMA débutants");
    const { rows } = await asCoach(coachB, (tx) =>
      tx.query<{ id: string }>(
        "insert into sessions (group_id, kind) values ($1, 'drill') returning id",
        [groupB],
      ),
    );
    await expect(
      asCoach(coachB, (tx) =>
        tx.query(
          `insert into metrics (session_id, athlete_id, key, category, value, confidence)
           values ($1, $2, 'stance_width', 'technique', 1.2, 0.9)`,
          [rows[0].id, athleteA],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("un visiteur non connecté n'a accès à aucune table", async () => {
    for (const table of ["coaches", "groups", "athletes", "metrics"]) {
      await expect(
        asAnonymous((tx) => tx.query(`select * from ${table}`)),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

describe("consentement et droit à l'effacement", () => {
  const consentOf = (athlete: string) =>
    asCoach(coachA, async (tx) => {
      const { rows } = await tx.query<{
        consent_status: string;
        analysis_allowed: boolean;
      }>(
        "select consent_status, analysis_allowed from athletes where id = $1",
        [athlete],
      );
      return rows[0];
    });

  const recordConsent = (coachId: string, athlete: string, status: string) =>
    asCoach(coachId, (tx) =>
      tx.query("insert into consents (athlete_id, status) values ($1, $2)", [
        athlete,
        status,
      ]),
    );

  it("bloque l'analyse par défaut tant qu'aucun consentement n'est enregistré", async () => {
    const athlete = await insertAthlete(coachA, "Noa");
    expect(await consentOf(athlete)).toEqual({
      consent_status: "missing",
      analysis_allowed: false,
    });
  });

  it("une entrée au journal met à jour le statut, un retrait rebloque l'analyse", async () => {
    const athlete = await insertAthlete(coachA, "Mehdi");

    await recordConsent(coachA, athlete, "minor_parental_confirmed");
    expect(await consentOf(athlete)).toEqual({
      consent_status: "minor_parental_confirmed",
      analysis_allowed: true,
    });

    await recordConsent(coachA, athlete, "withdrawn");
    expect(await consentOf(athlete)).toEqual({
      consent_status: "withdrawn",
      analysis_allowed: false,
    });
  });

  it("le statut ne peut pas être modifié sans passer par le journal", async () => {
    const athlete = await insertAthlete(coachA, "Sofiane");
    await expect(
      asCoach(coachA, (tx) =>
        tx.query(
          "update athletes set consent_status = 'adult_confirmed' where id = $1",
          [athlete],
        ),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      asCoach(coachA, (tx) =>
        tx.query(
          "insert into athletes (display_name, consent_status) values ('Triche', 'adult_confirmed')",
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuse un consentement « adulte » pour un athlète mineur", async () => {
    const { rows } = await asCoach(coachA, (tx) =>
      tx.query<{ id: string }>(
        `insert into athletes (display_name, birth_date)
         values ('Adam', (current_date - interval '15 years')::date) returning id`,
      ),
    );
    const athlete = rows[0].id;

    await expect(recordConsent(coachA, athlete, "adult_confirmed")).rejects.toThrow(
      /consentement parental/,
    );
    expect((await consentOf(athlete)).analysis_allowed).toBe(false);

    await recordConsent(coachA, athlete, "minor_parental_confirmed");
    expect((await consentOf(athlete)).analysis_allowed).toBe(true);
  });

  it("le coach B ne peut pas enregistrer un consentement pour un athlète du coach A", async () => {
    const athlete = await insertAthlete(coachA, "Rayan");
    await expect(
      recordConsent(coachB, athlete, "adult_confirmed"),
    ).rejects.toThrow(/foreign key/);
    expect((await consentOf(athlete)).analysis_allowed).toBe(false);
  });

  it("le journal de consentement ne peut pas être réécrit", async () => {
    const athlete = await insertAthlete(coachA, "Yanis");
    await asCoach(coachA, (tx) =>
      tx.query(
        "insert into consents (athlete_id, status) values ($1, 'adult_confirmed')",
        [athlete],
      ),
    );
    await expect(
      asCoach(coachA, (tx) =>
        tx.query("update consents set status = 'missing' where athlete_id = $1", [
          athlete,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("supprimer un athlète efface toutes ses données liées", async () => {
    const athlete = await insertAthlete(coachA, "Inès");
    const group = await insertGroup(coachA, "JJB mercredi");

    await asCoach(coachA, async (tx) => {
      await tx.query(
        "insert into athlete_groups (athlete_id, group_id) values ($1, $2)",
        [athlete, group],
      );
      await tx.query(
        "insert into consents (athlete_id, status) values ($1, 'adult_confirmed')",
        [athlete],
      );
      const session = await tx.query<{ id: string }>(
        "insert into sessions (group_id, kind) values ($1, 'technique') returning id",
        [group],
      );
      const sessionId = session.rows[0].id;
      await tx.query(
        "insert into session_athletes (session_id, athlete_id) values ($1, $2)",
        [sessionId, athlete],
      );
      await tx.query(
        `insert into pose_series (session_id, athlete_id, storage_path, sample_rate_hz, frame_count, duration_s)
         values ($1, $2, 'x/y/z.bin', 10, 600, 60)`,
        [sessionId, athlete],
      );
      await tx.query(
        `insert into metrics (session_id, athlete_id, key, category, value, confidence)
         values ($1, $2, 'guard_height', 'technique', 0.4, 0.8)`,
        [sessionId, athlete],
      );
      await tx.query(
        "insert into insights (session_id, athlete_id, content) values ($1, $2, '{}')",
        [sessionId, athlete],
      );
    });

    await asCoach(coachA, (tx) =>
      tx.query("delete from athletes where id = $1", [athlete]),
    );

    // Vérification hors RLS (rôle propriétaire) : il ne doit rien rester.
    for (const table of [
      "athlete_groups",
      "consents",
      "session_athletes",
      "pose_series",
      "metrics",
      "insights",
    ]) {
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n from ${table} where athlete_id = $1`,
        [athlete],
      );
      expect(rows[0].n, table).toBe(0);
    }
  });
});
