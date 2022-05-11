import Deliveries from '@/models/Deliveries.model';

const find = async (req) => {
  // some vars
  let query = {};
  let limit = req.body.limit ? (req.body.limit > 100 ? 100 : parseInt(req.body.limit)) : 100;
  let skip = req.body.page ? ((Math.max(0, parseInt(req.body.page)) - 1) * limit) : 0;
  let sort = { _id: 1 };

  // if date provided, filter by date
  if (req.body.when) {
    query['when'] = {
      '$gte': req.body.when
    };
  }

  let totalResults = await Deliveries.find(query).countDocuments();

  if (totalResults < 1) {
    throw {
      code: 404,
      data: {
        message: 'We couldn\'t find any delivery'
      }
    };
  }

  let deliveries = await Deliveries.find(query).skip(skip).sort(sort).limit(limit);

  return {
    totalResults: totalResults,
    deliveries
  };
};

const create = async (req) => {
  try {
    await Deliveries.create(req.body);
  } catch (e) {
    throw {
      code: 400,
      data: {
        message: `An error has occurred trying to create the delivery:
          ${JSON.stringify(e, null, 2)}`
      }
    };
  }
};

const findOne = async (req) => {
  let delivery = await Deliveries.findOne({ _id: req.body.id });
  if (!delivery) {
    throw {
      code: 404,
      data: {
        message: 'We couldn\'t find a delivery with the sent ID'
      }
    };
  }
  return delivery;
};

const filter = async (req) => {
  // obtener variables para filtrar los documentos de delivery
  let { dateFrom, dateTo, weight } = req.body;

  // obtener variables para limitar el query de los documentos de delivery
  let limit = req.body.limit ? (req.body.limit > 100 ? 100 : parseInt(req.body.limit)) : 100;
  let skip = req.body.page ? ((Math.max(0, parseInt(req.body.page)) - 1) * limit) : 0;
  // let sort = { _id: 1 };

  // preparar query para obtener deliveries
  let queryAggregator = [
    {
      $match: {
        when: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
      }
    },
    {
      $skip: skip
    },
    {
      $limit: limit
    },
    {
      $unwind: {
        path: '$products',
      }
    },
    {
      $lookup:
      {
        from: 'products',
        let: { product: '$products' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$product']
              }
            }
          },
        ],
        as: 'product'
      }
    },
    {
      $group: {
        origin: { $first: '$origin' },
        destination: { $first: '$destination' },
        products: { $addToSet: { $first: '$product' } },
        _id: '$_id',
        when: { $first: '$when' },
        __v: { $first: '$__v' }
      }
    },
    {
      $match: {
        'products.weight': { $gte: weight }
      }
    },
    {
      $group: {
        _id: null,
        totalResults: { $sum: 1 },
        deliveries: {
          $push: '$$ROOT'
        },
      }
    },
    {
      $project: {
        _id: 0,
        totalResults: 1,
        deliveries: 1
      }
    },
  ];

  // ejecutar query
  let delivery = await Deliveries.aggregate(queryAggregator);
  if (!delivery) {
    throw {
      code: 404,
      data: {
        message: 'We couldn\'t find a delivery with the sent ID'
      }
    };
  }
  return delivery;
};

export default {
  find,
  create,
  findOne,
  filter
};
