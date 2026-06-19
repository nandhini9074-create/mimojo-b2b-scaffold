import { generateModuleCode } from '../src/nodes/generateModuleCode';
import { PipelineState } from '../src/state';

async function runTest() {
  const referenceSnippet = `
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { v4 as uuidv4 } from 'uuid';
import { CardStatus } from 'src/enums/card-status.enum';
import { EnrollCardDto } from '../dto/enrol-card.dto';
import { Customer } from '../entities/customer.model';
import { UserCard } from '../entities/user-card.model';

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(
    @InjectModel(Customer)
    private readonly customerModel: typeof Customer,
    @InjectModel(UserCard)
    private readonly userCardModel: typeof UserCard,
  ) {}

  async enrollCard(payload: EnrollCardDto): Promise<any> {
    const traceId = uuidv4();
    const customer = await this.findOrCreateCustomer(payload.customerId);
    const cardsToProcess = this.flattenCards(payload.cardDetails);

    const cardResults: Array<Record<string, unknown>> = [];

    for (const card of cardsToProcess) {
      if (!card.isNewCard) {
        cardResults.push({
          cardId: card.cardId,
          status: 'Skipped',
          message: 'Card skipped because isNewCard is false',
        });
        continue;
      }

      const duplicate = await this.userCardModel.findOne({
        where: { schemeCardId: card.schemeCardId, isActive: true },
      });

      if (duplicate) {
        cardResults.push({
          cardId: card.cardId,
          status: 'Duplicate',
          mimojoCardId: duplicate.id,
        });
        continue;
      }

      const created = await this.userCardModel.create({
        userId: customer.id,
        cardId: card.cardId,
        schemeCardId: card.schemeCardId,
        cardScheme: 'UNKNOWN',
        cardBin: null,
        cardLast4: (card.cardLast4 ?? '0000').toString().slice(-4),
        schemeUserId: payload.schemeUserId,
        fingerPrint: null,
        issuerBank: null,
        isActive: true,
        profileId: null,
        parentCardId: card.parentCardId,
        isSupplementary: card.isSupplementary,
        status: CardStatus.ACTIVE,
        activity: null,
      });

      cardResults.push({
        cardId: card.cardId,
        status: 'Success',
        mimojoCardId: created.id,
      });
    }

    const response = {
      traceId,
      statusCode: HttpStatus.OK.toString(),
      message: 'Card enrollment processed successfully',
      data: {
        cardResults,
      },
    };

    this.logger.log(\`enrollCard completed: \${traceId}\`);
    return response;
  }

  private async findOrCreateCustomer(customerId: string): Promise<Customer> {
    const existing = await this.customerModel.findOne({ where: { customerId } });
    if (existing) {
      return existing;
    }
    return this.customerModel.create({ customerId });
  }

  private flattenCards(cardDetails: EnrollCardDto['cardDetails']): Array<{
    cardId: string;
    schemeCardId: string;
    cardLast4?: number | string;
    isNewCard: boolean;
    isSupplementary: boolean;
    parentCardId: string | null;
  }> {
    return cardDetails.flatMap((card) => {
      const main = {
        cardId: card.cardId,
        schemeCardId: card.schemeCardId,
        cardLast4: card.cardLast4,
        isNewCard: card.isNewCard,
        isSupplementary: false,
        parentCardId: null,
      };

      const supplementary = (card.supplementaryCards ?? []).map((supp) => ({
        cardId: supp.cardId,
        schemeCardId: supp.schemeCardId,
        cardLast4: supp.cardLast4,
        isNewCard: supp.isNewCard,
        isSupplementary: true,
        parentCardId: card.cardId,
      }));

      return [main, ...supplementary];
    });
  }
}
`;

  const state: PipelineState = {
    projectName: 'enrollment-template-service',
    features: [{ name: 'enroll card' }],
    stage: 'code',
    history: [],
    code_plan: { files: ['src/enrollment/services/enroll.service.ts'] },
    github_refs: [
      {
        feature: 'enroll card',
        repo: 'mimojo/card-service',
        path: 'src/card/services/card.service.ts',
        url: 'http://github.com/mimojo/card-service',
        snippet: referenceSnippet
      }
    ],
    db_schema: '', // omitting for test to focus on logic preservation
    functions_list: {
      modules: [
        {
          name: 'enrollment',
          functions: [
            {
              name: 'enroll',
              inputs: ['payload: EnrollCardDto'],
              outputs: ['Promise<any>'],
              feature: 'enroll card'
            }
          ]
        }
      ]
    }
  };

  const result = await generateModuleCode(state);
  console.log("=== GENERATED CODE ===");
  console.log(result['src/enrollment/services/enroll.service.ts']);
}

runTest().catch(console.error);
