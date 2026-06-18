import { Model } from 'sequelize';
import { SequelizeHooks } from 'sequelize/types/hooks';
import { DataOperationsProducer } from './data-operations';

class SequelizeHooksHandler {
  hooks: Partial<SequelizeHooks>;

  constructor(private readonly dataOperationsProducer: DataOperationsProducer) {
    this.hooks = {
      afterCreate: this.afterCreate.bind(this),
      afterBulkCreate: this.afterBulkCreate.bind(this),
      beforeUpdate: this.beforeUpdate.bind(this),
      beforeBulkUpdate: this.beforeBulkUpdate.bind(this),
      beforeUpsert: this.beforeUpsert.bind(this),
      afterDestroy: this.afterDestroy.bind(this),
      afterBulkDestroy: this.afterBulkDestroy.bind(this),
    };
  }

  private async afterCreate(instance: Model) {
    if (instance?.dataValues) {
      this.pushOrganizedData(instance?.constructor?.name, 'AFTERCREATE', [], [instance?.dataValues]);
    }
  }

  private async afterBulkCreate(instance: Model, options: any) {
    if (instance) {
      this.pushOrganizedData(options?.model?.name, 'AFTERBULKCREATE', [], instance);
    }
  }

  private async beforeUpdate(instance: Model) {
    if (instance?.dataValues) {
      this.pushOrganizedData(
        instance?.constructor?.name,
        'BEFOREUPDATE',
        [instance?.['_previousDataValues']],
        [instance?.dataValues]
      );
    }
  }

  private async beforeBulkUpdate(options: any) {
    const modelData = await options?.model?.findAll({ where: options.where });
    const previousValues = modelData?.map((data: any) => data.get({ plain: true }));
    const updatedValues = options?.attributes;
    previousValues.forEach((prev: any) => {
      const current = { ...prev, ...updatedValues };
      this.pushOrganizedData(options?.model?.name, 'BEFOREBULKUPDATE', [prev], [current]);
    });
  }

  private async beforeUpsert(instance: Model, options: any) {
    const model = options?.model;
    const primaryKeyFields = options?.fields;
    const whereCondition: any = {};
    for (const key of primaryKeyFields) {
      whereCondition[key] = options?.instance?.dataValues[key];
    }
    const existingData = await model.findOne({ where: whereCondition });
    if (existingData) {
      const previousValues = existingData?.dataValues;
      const currentValues = { ...previousValues, ...instance };
      this.pushOrganizedData(model?.name, 'BEFOREUPSERT', [previousValues], [currentValues]);
    } else {
      this.pushOrganizedData(model?.name, 'BEFOREUPSERT', [], [options?.instance?.dataValues]);
    }
  }

  private async afterDestroy(instance: Model) {
    if (instance?.dataValues) {
      this.pushOrganizedData(instance?.constructor?.name, 'AFTERDESTROY', [], [instance?.dataValues]);
    }
  }

  private async afterBulkDestroy(options: any) {
    const modelData = await options.model.findAll({ where: options.where });
    if (modelData?.length > 0) {
      this.pushOrganizedData(options?.model?.name, 'AFTERBULKDESTROY', [], modelData);
    }
  }

  private pushOrganizedData(modelName: any, action: any, previousValues: any, currentValues: any) {
    this.dataOperationsProducer.pushToAuditLogService(
      'mimojo-nest-template-service',
      {
        modelName,
        action,
        previousValues,
        currentValues,
      },
      null
    );
  }

  getHooks(): Partial<SequelizeHooks> {
    return this.hooks;
  }
}

export default SequelizeHooksHandler;
