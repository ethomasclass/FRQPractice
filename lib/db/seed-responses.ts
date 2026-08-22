/**
 * Development only. Submits a spread of responses to the seeded assignment so
 * the review, grading, and release flows can be exercised without twenty
 * people typing for twenty-five minutes.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const newId = () => randomBytes(16).toString("hex");

/** Deliberately uneven: strong, middling, and the classic describe-not-explain misses. */
const SAMPLE_RESPONSES = [
  `A. An independent state is a political entity that governs itself and is not controlled by any outside power. It has its own territory, its own laws, and is recognized by other states.

B. One purpose of supranational organizations is to let member states cooperate on problems that cross international borders, like pollution or trade barriers, that no single country can solve alone.

C. One global outcome of increased international trade is the growth of special economic zones and export processing zones, where countries set aside areas with lower tariffs to attract foreign manufacturing.

D. Deindustrialization has shifted core country economies away from manufacturing and toward services and technology, because firms moved factory work to countries with cheaper labor, so the remaining jobs at home are concentrated in finance, health care, and information.

E. International boundaries lead to resource disputes because maritime boundaries often overlap, so when oil or fisheries sit in a zone claimed by two countries under UNCLOS, each state insists the resource falls inside its own exclusive economic zone.

F. Supranational organizations challenge sovereignty because member states must follow rules made by the organization rather than by their own government. An EU member cannot set its own tariff on goods from outside the union, so the power to control its own trade policy has been transferred upward.

G. Communication technology affects sovereignty because social media lets movements organize faster than a government can respond. When people spread information about protests across a whole country in hours, the state loses its monopoly on information and may be forced to change policy.`,

  `A. An independent state is a country that has its own government and controls its own land.

B. Supranational organizations exist so countries can work together. The EU is an example of this and it has many member states in Europe.

C. International trade going up means countries trade more goods with each other and there is more globalization around the world.

D. Deindustrialization means factories closed in core countries. A lot of manufacturing jobs went away and cities like Detroit lost population.

E. Boundaries cause disputes over resources because countries both want the resources that are near the boundary between them.

F. Supranational organizations can challenge sovereignty of member states because the states have to follow what the organization says.

G. Communication technology affects state sovereignty because people can communicate more easily now than they could before.`,

  `A. An independent state is the basic building block of the world political map. It is a sovereign country with defined borders and a government that answers to no higher authority.

B. Supranational organizations are created to align states that share a common objective, such as a military alliance or a common market, so they can act with more weight than any one member could alone.

C. An increase in international trade leads to outsourcing, as firms in countries with high labor costs move production to countries where labor is cheaper, increasing competition between those countries.

D. Deindustrialization affected core economies by causing widespread unemployment in manufacturing regions. When plants closed, the loss of jobs reduced local business investment and whole regions declined economically.

E. Boundaries at sea lead to disputes because political boundaries are sometimes superimposed over resource areas, meaning a single oil field or fishery can be split between two states that each claim ownership of the whole thing.

F. The EU challenges sovereignty by imposing regional governance changes — a common currency, shared border policy, shared judicial review — that supersede the national systems those member states used to run themselves.

G. Advances in communication technology can strengthen supranationalism and devolution, because groups within a state can coordinate with outside organizations directly, changing the structure of governance without going through the national government.`,

  `A. A state that is independent and sovereign over itself.

B. To help countries.

C. More trade means more money moving around the world between different countries that are trading.

D. Deindustrialization is when industry leaves a country. This happened in core countries a lot in the twentieth century and it changed their economies.

E. Countries fight over resources when they are near a border, because both countries want to have the resource for themselves and neither wants to give it up.

F. Being in a supranational organization means giving up some control, which is a challenge to sovereignty for the member states involved.

G. Technology changed how governments work because information moves faster now.`,

  `A. An independent state is a sovereign political unit that governs itself autonomously and is recognized by other states as having control over its territory and laws.

B. A purpose of supranational organizations is to create free trade zones and lending agencies that reduce the cost of doing business across borders for all members.

C. One global outcome is wider access to more diverse goods, services, and technology, since consumers in one country can buy products manufactured anywhere in the world.

D. Deindustrialization contributed to an international division of labor. Core countries kept higher-paying design, finance, and management jobs while assembly work moved to the semiperiphery, so the core economy became more unequal but more specialized.

E. Countries may disagree about international agreements like UNCLOS that define rights over the sea, and when two states read the same agreement differently, both claim the same fishing grounds.

F. Supranational organizations implement laws that limit the economic actions of individual members. A member state that wants to subsidize its own farmers may be blocked by union competition rules, so it cannot act on its own economic judgment.

G. Communication technology increases the ability of supranational organizations to monitor member states, because satellite and digital reporting let the organization verify whether a member is upholding an environmental agreement.`,

  `A. An independent state is a country like France or Japan that runs itself.

B. Supranational organizations create trade agreements and military alliances between the states that join them.

C. When international trade increases there is more pollution and more use of natural resources globally because more goods are being shipped around.

D. Core countries lost manufacturing and this hurt their economies badly in places that depended on factories.

E. There are disputes because more than one country claims to own the same resource that sits along a contested boundary.

F. Member states have to open their borders for trade even if they do not want to, which takes away some of their sovereignty.

G. Social media allows people to see what is happening in other countries and they might want the same things.`,

  `A. Independent state means it is independent and has its own government that is not controlled by another country.

B. The purpose is to address transnational challenges such as climate change, which affect many countries at once and cannot be handled by one state.

C. An increase in trade causes deindustrialization in more developed core countries as production shifts elsewhere.

D. Deindustrialization has led core countries and cities to develop strategies to attract new businesses, such as offering lower taxes to firms that relocate there, in order to replace the tax base they lost when factories closed.

E. Indigenous groups and local communities may have competing claims to a resource that the national government also claims, and the boundary drawn on the map does not match who actually uses the land.

F. Supranational organizations require participation in military alliances, so a member state may be obligated to join a conflict that its own government did not choose.

G. Communication technology lets social movements reach a much larger audience about political issues, and that pressure has led to changes in government policy and in some cases the devolution of state power to regions.`,

  `A. It is a state that is independent.

B. Supranational organizations are groups of countries.

C. Trade increases globalization.

D. Factories closed in core countries and moved to other countries where it is cheaper to make things.

E. Boundaries cause disputes.

F. The EU makes rules for its members.

G. The internet makes it harder for governments to control information.`,
];

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const assignment = await db.query.assignments.findFirst();
  if (!assignment) throw new Error("No assignment found. Run npm run db:seed first.");

  const roster = await db.query.students.findMany({ where: eq(schema.students.sectionId, assignment.sectionId) });
  const writers = roster.slice(0, SAMPLE_RESPONSES.length);

  for (const [i, student] of writers.entries()) {
    const existing = await db.query.responses.findFirst({
      where: eq(schema.responses.studentId, student.id),
    });
    if (existing) continue;

    const startedAt = new Date(Date.now() - 30 * 60_000);
    await db.insert(schema.responses).values({
      id: newId(),
      assignmentId: assignment.id,
      studentId: student.id,
      text: SAMPLE_RESPONSES[i],
      startedAt,
      submittedAt: new Date(startedAt.getTime() + 24 * 60_000),
    });
  }

  await db.update(schema.assignments).set({ status: "writing" }).where(eq(schema.assignments.id, assignment.id));

  console.log(`Submitted ${writers.length} responses for "${assignment.title}".`);
  console.log(`${roster.length - writers.length} students left unsubmitted, to exercise the absent-student path.`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
