import { db } from '../lib/db';

async function main() {
    const word = await db.vocab.findUnique({
        where: { word: 'opening' },
        select: { collocations: true }
    });
    console.log(JSON.stringify(word, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
