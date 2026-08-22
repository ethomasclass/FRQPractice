/**
 * Seeds one section, a roster, and the 2025 Set 1 Question 1 rubric transcribed
 * from the released College Board scoring guideline. Real material, because a
 * rubric model that can't hold a real scoring guideline is the wrong model.
 *
 * Development only. Run: npm run db:seed
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import type { TaskVerb } from "./schema";

const newId = () => randomBytes(16).toString("hex");

const ROSTER = [
  "Amara Okafor", "Ben Whitfield", "Camila Reyes", "Dmitri Volkov", "Elena Marchetti",
  "Farid Haddad", "Grace Lindqvist", "Hassan Mahmoud", "Isabel Nakamura", "Jonah Brennan",
  "Kiara Patel", "Liam O'Donnell", "Maya Rosenberg", "Noah Ferreira", "Olivia Chen",
  "Priya Raghavan", "Quinn Delacroix", "Rosa Alvarez", "Samuel Adeyemi", "Tessa Lindgren",
];

type SeedPart = { label: string; taskVerb: TaskVerb; promptText: string; criteria: [string, string][] };

/** AP Human Geography 2025, Set 1, Question 1 (No Stimulus) — 7 points. */
const QUESTION_1: SeedPart[] = [
  {
    label: "A",
    taskVerb: "Define",
    promptText: "Define the concept of an independent state.",
    criteria: [
      ["A1", "The primary building block of the world political map."],
      ["A2", "A sovereign country, sovereign state, or a political entity with its own independent government (governs itself autonomously and is not controlled by any other external power)."],
      ["A3", "A country with control over its own territory or laws, and/or a country that is recognized by other states."],
    ],
  },
  {
    label: "B",
    taskVerb: "Describe",
    promptText: "Describe one purpose of supranational organizations.",
    criteria: [
      ["B1", "To address transnational or environmental challenges, and/or to create economies of scale, trade agreements, and/or military alliances."],
      ["B2", "To align member states (countries) that have a common interest or objective (e.g., administrative, economic, environmental, military, strategic, peace, security)."],
      ["B3", "To create free trade zones, cartels, lending agencies, and/or research institutions."],
      ["B4", "To reduce the operational cost of governance, regulation, tariffs, business operations, currency exchange, banking fees and/or legal expenses."],
      ["B5", "To increase regional or organizational economic power, productivity (e.g., gross national product), and/or size of the available labor force."],
    ],
  },
  {
    label: "C",
    taskVerb: "Describe",
    promptText: "Describe one global outcome of an increase in international trade.",
    criteria: [
      ["C1", "An increase in international trade allows countries to use comparative advantage and/or complementarity to specialize in the production of goods and/or services."],
      ["C2", "Increase in globalization, free trade, trade agreements, interdependence, supranational organizations, and/or rising levels of international development."],
      ["C3", "Outsourcing of jobs from countries with higher labor costs to countries with lower labor costs and/or increased competition between countries."],
      ["C4", "Deindustrialization in more developed/core countries or regions."],
      ["C5", "Improved or expanded infrastructure (e.g., port facilities, warehouses, roads, transportation networks)."],
      ["C6", "Increased pollution, use of natural resources, and/or environmental impacts."],
      ["C7", "New manufacturing zones, free trade zones, special economic zones, and/or export processing zones."],
      ["C8", "Changes in the economic sectors of national economies and/or changes in methods of production."],
      ["C9", "Increased potential for supply chain problems (e.g., halted production, delayed shipment, tariffs, trade restrictions, labor shortages, quality control issues, technological integration, sustainability pressures, cost increases)."],
      ["C10", "Wider access to more diverse goods, services, technology, media, and/or ideas."],
      ["C11", "Lower production costs and/or prices for consumers."],
    ],
  },
  {
    label: "D",
    taskVerb: "Explain",
    promptText: "Explain how deindustrialization has affected the economy of core countries.",
    criteria: [
      ["D1", "Economies have shifted away from manufacturing toward services and technology as the main sources of economic production."],
      ["D2", "The loss of manufacturing businesses and/or jobs resulted in widespread unemployment, economic decline, and/or less business investment."],
      ["D3", "Deindustrialization has contributed to an international division of labor and/or an economic sector shift in which core countries have higher-paying jobs."],
      ["D4", "Outsourcing, offshoring, and/or economic restructuring have led to a decline in jobs in core countries and an increase in jobs in newly industrialized countries (developing countries, semiperiphery)."],
      ["D5", "Core countries and/or cities have developed strategies designed to attract new businesses to replace those lost from deindustrialization (e.g., lower taxes for businesses that relocate)."],
    ],
  },
  {
    label: "E",
    taskVerb: "Explain",
    promptText: "Explain why international boundaries on land or at sea may lead to disputes over resources.",
    criteria: [
      ["E1", "Boundaries may be contested due to more than one country or company claiming ownership over a resource."],
      ["E2", "Countries may disagree with international agreements that define the rights and responsibilities of countries (e.g., United Nations Convention on the Law of the Sea [UNCLOS])."],
      ["E3", "Political boundaries may be superimposed over resource areas claimed by different countries."],
      ["E4", "Corporations, indigenous groups, and/or local communities may have competing claims to resources."],
    ],
  },
  {
    label: "F",
    taskVerb: "Explain",
    promptText: "Explain how supranational organizations such as the EU or ASEAN may challenge the sovereignty of member states.",
    criteria: [
      ["F1", "Supranational organizations implement international laws or policies that may result in limitations on the economic or political actions of individual member states."],
      ["F2", "Supranational organizations may require participation in military alliances or impose changes in regional governance (e.g., border policies, currencies, trade regulations, environmental regulations, labor regulations, taxes, judicial systems) that replace or supersede existing systems of national government in member states."],
    ],
  },
  {
    label: "G",
    taskVerb: "Explain",
    promptText: "Explain how advances in communication technologies may affect state sovereignty.",
    criteria: [
      ["G1", "Advances in technology may affect state sovereignty by facilitating devolution, supranationalism, and/or democratization efforts that change the structure of the state or its system of governance."],
      ["G2", "Advances in technology may affect state sovereignty by allowing people, social movements, and/or organizations (e.g., other governments, corporations) to communicate faster or more effectively, or to a larger audience, about political issues and/or social justice, leading to changes in law, government policy, strengthening of the state, and/or the devolution of the state."],
      ["G3", "Advances in technology may affect state sovereignty by increasing the ability of a supranational organization to monitor what is occurring in member states (e.g., upholding agreements and enforcing regulations)."],
    ],
  },
];

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const sectionId = newId();
  await db.insert(schema.sections).values({
    id: sectionId,
    name: "AP Human Geography — Period 2",
    term: "Fall 2026",
    joinCode: "K4TR9M",
  });

  const roster = ROSTER.map((name) => ({
    id: newId(),
    sectionId,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.edu`,
  }));
  await db.insert(schema.students).values(roster);

  const assignmentId = newId();
  await db.insert(schema.assignments).values({
    id: assignmentId,
    sectionId,
    title: "Supranational Organizations and Sovereignty",
    intro:
      "The European Union (EU) and Association of Southeast Asian Nations (ASEAN) are supranational organizations composed of independent member states.",
    timeLimitMinutes: 25,
    reviewsPerResponse: 4,
    status: "draft",
  });

  for (const [i, part] of QUESTION_1.entries()) {
    const partId = newId();
    await db.insert(schema.rubricParts).values({
      id: partId,
      assignmentId,
      label: part.label,
      orderIndex: i,
      taskVerb: part.taskVerb,
      promptText: part.promptText,
    });
    await db.insert(schema.rubricCriteria).values(
      part.criteria.map(([code, text], j) => ({ id: newId(), partId, code, orderIndex: j, text })),
    );
  }

  // A second, empty assignment left in draft so the rubric editor and the
  // drafting panel can be exercised without disturbing the first one.
  await db.insert(schema.assignments).values({
    id: newId(),
    sectionId,
    title: "Untitled FRQ (draft)",
    timeLimitMinutes: 25,
    reviewsPerResponse: 4,
    status: "draft",
  });

  console.log(`Seeded section ${sectionId} (join code K4TR9M) with ${roster.length} students.`);
  console.log(`Seeded assignment ${assignmentId} with ${QUESTION_1.length} rubric parts.`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
