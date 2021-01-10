import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Could not find customer whith the given id');
    }

    const existsProducts = await this.productsRepository.findAllById(products);

    if (!existsProducts.length) {
      throw new AppError('Could not find products whith the given ids');
    }

    const existenstProductIds = existsProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existenstProductIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find producs whith id ${checkInexistentProducts[0].id} `,
      );
    }

    const findProductsWhithQuantityAvailable = products.filter(
      product =>
        existsProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWhithQuantityAvailable.length) {
      throw new AppError(
        `The quantiy ${findProductsWhithQuantityAvailable[0].quantity} is not available for product id ${findProductsWhithQuantityAvailable[0].id} `,
      );
    }

    const serializedProduct = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existsProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProduct,
    });

    console.log(order);
    const { order_products } = order;

    const ordersProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existsProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(ordersProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
