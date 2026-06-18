import { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { Table, Column, Model, DataType } from 'sequelize-typescript';

/**
 * Persistent record of a scaffold pipeline session.
 *
 * The full PipelineState (inputs, every stage's output, history, refinements,
 * timings, current stage) is stored as a single JSONB blob in `state`. This keeps
 * the schema flat — every approve/reject/restart simply overwrites the JSONB —
 * while still letting us list, search, and load any prior session in one shot.
 */
@Table({ tableName: 'scaffold_sessions', timestamps: true })
export class ScaffoldSession extends Model<
  InferAttributes<ScaffoldSession>,
  InferCreationAttributes<ScaffoldSession>
> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare projectName: string;

  /** Current pipeline stage (functions | diagrams | docs | db | code | github | done). */
  @Column({ type: DataType.STRING, allowNull: false })
  declare stage: string;

  /** Full PipelineState snapshot. */
  @Column({ type: DataType.JSONB, allowNull: false })
  declare state: Record<string, unknown>;

  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}
