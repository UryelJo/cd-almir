import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent (Frontend - Fluxo Real)', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    // Mock do EventSource e fetch para o ambiente de testes do navegador
    (global as any).EventSource = jest.fn().mockImplementation(() => ({
      close: jest.fn(),
      addEventListener: jest.fn(),
    }));

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ counts: { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 }, jobs: [] }),
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar a aplicação frontend com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve inicializar com valores padrão corporativos no formulário', () => {
    expect(component.reportTitle).toContain('Relatório');
    expect(component.clientName).toBeTruthy();
    expect(component.items.length).toBeGreaterThan(0);
  });

  it('deve adicionar um novo item dinâmico na tabela de itens', () => {
    const initialCount = component.items.length;
    component.addItem();
    expect(component.items.length).toBe(initialCount + 1);
  });

  it('deve remover um item da tabela respeitando o mínimo de 1 item', () => {
    component.items = [
      { description: 'Item 1', quantity: 1, unitPrice: 100 },
      { description: 'Item 2', quantity: 2, unitPrice: 200 },
    ];
    component.removeItem(0);
    expect(component.items.length).toBe(1);
    expect(component.items[0].description).toBe('Item 2');

    // Não deve remover quando só houver 1 item
    component.removeItem(0);
    expect(component.items.length).toBe(1);
  });

  it('deve calcular o valor total estimado corretamente com base na quantidade e preço unitário', () => {
    component.items = [
      { description: 'Serviço A', quantity: 2, unitPrice: 150.0 }, // 300
      { description: 'Serviço B', quantity: 3, unitPrice: 50.0 },  // 150
    ];

    const total = component.calculateTotal();
    expect(total).toBe(450.0);
  });

  it('deve atualizar o estado do job e disponibilizar o link de download ao receber evento SSE de conclusão', () => {
    // Simula evento SSE de conclusão emitido pelo backend
    (component as any).handleRealtimeEvent({
      jobId: '88',
      title: 'Relatório Teste SSE',
      status: 'completed',
      progress: 100,
      downloadUrl: '/api/reports/88/pdf',
      timestamp: new Date().toISOString(),
    });

    const job = component.jobs.find(j => j.id === '88');
    expect(job).toBeDefined();
    expect(job?.state).toBe('completed');
    expect(job?.progress).toBe(100);
    expect(job?.downloadUrl).toBe('/api/reports/88/pdf');
    expect(component.queueCounts.completed).toBeGreaterThan(0);
  });
});

