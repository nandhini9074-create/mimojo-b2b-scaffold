import { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'users' })
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV1,
  })
  declare id: CreationOptional<string>;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare userName: string;
}
