import { db } from "~/server/db";

async function main() {
  const admin = await db.user.findFirst({
    where: {
      email: {
        in: [
          "admin@example.com",
          "albertjorlando@gmail.com",
          "superuser@example.com",
        ],
      },
    },
  });
  if (!admin) {
    console.error("No admin-like user found");
    process.exit(1);
  }
  const session = await db.session.findFirst({
    where: { userId: admin.id },
    orderBy: { expires: "desc" },
  });
  if (!session) {
    console.error("No session found for admin user");
    process.exit(2);
  }
  console.log(session.sessionToken);
}

main().finally(() => db.$disconnect());
