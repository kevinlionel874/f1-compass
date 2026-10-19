// Lists the NVIDIA / Nemotron model IDs your Nebius Token Factory key can use.
// Run with: npm run models

const key = process.env.NEBIUS_API_KEY;
if (!key) {
  console.error("NEBIUS_API_KEY is not set. Add it to .env.local first.");
  process.exit(1);
}

const base = process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1";
const res = await fetch(`${base}/models`, {
  headers: { Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`Request failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}

const { data } = await res.json();
const ids = data.map((m) => m.id).sort();
const nvidia = ids.filter((id) => /nvidia|nemotron/i.test(id));

console.log("NVIDIA / Nemotron models available to your key:\n");
for (const id of nvidia) console.log(`  ${id}`);
console.log(
  `\n${ids.length} models in total. Put the IDs you want in NEBIUS_FAST_MODEL and NEBIUS_REASONING_MODEL in .env.local.`,
);
