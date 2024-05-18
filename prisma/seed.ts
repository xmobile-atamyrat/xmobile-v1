import dbClient from '@/lib/dbClient';

const categories = [
  {
    name: 'Laptops',
    imgUrl:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-midnight-select-202402?wid=904&hei=840&fmt=jpeg&qlt=90&.v=1708367688034',
    successorCategories: [
      {
        name: 'Mac',
        imgUrl: null,
        successorCategories: [
          {
            name: 'M1',
            imgUrl: null,
            successorCategories: [],
          },
        ],
      },
      {
        name: 'Asus',
        imgUrl: null,
        successorCategories: [],
      },
      {
        name: 'Acer',
        imgUrl: null,
        successorCategories: [],
      },
    ],
  },
  {
    name: 'Phones',
    imgUrl: 'https://m.media-amazon.com/images/I/519NJUQbvTL._AC_SX679_.jpg',
    successorCategories: [
      {
        name: 'Samsung',
        imgUrl: null,
        successorCategories: [],
      },
      {
        name: 'iPhone',
        imgUrl: null,
        successorCategories: [],
      },
      {
        name: 'LG',
        imgUrl: null,
        successorCategories: [],
      },
    ],
  },
];
async function main() {
  categories.forEach(async (category) => {
    await dbClient.category.create({
      data: {
        name: category.name,
        imgUrl: category.imgUrl,
        successorCategories: {
          create: category.successorCategories.map((s) => ({
            name: s.name,
            imgUrl: s.imgUrl,
            successorCategories: {
              create: s.successorCategories.map((ss) => ({
                name: ss.name,
                imgUrl: ss.imgUrl,
              })),
            },
          })),
        },
      },
    });
  });
}

main()
  .then(async () => {
    await dbClient.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await dbClient.$disconnect();
    process.exit(1);
  });
