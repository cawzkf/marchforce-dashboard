export const LIMITS = {
  motor_temp: { label: 'Motor', unit: '°C', warn: 90, crit: 110, max: 125 },
  battery_temp: { label: 'Bateria', unit: '°C', warn: 45, crit: 60, max: 70 },
  controller_temp: { label: 'Inversor', unit: '°C', warn: 70, crit: 85, max: 100 },
  idc: { label: 'Corrente DC', unit: 'A', warn: 10, crit: 12, max: 16 },
  vdc: { label: 'Tensão DC', unit: 'V', warn: 45, crit: 37.5, max: 60, falling: true },
}

export const PACK = { cells: 15, capacityAh: 6, energyWh: 288, cellMin: 2.5, cellMax: 3.65 }
export const RACE = { laps: 10, lapLength: 853, durationS: 1500 }
export const MOTOR = { nominalTorque: 0.627, peakTorque: 1.217, noLoadRpm: 4241, rpm16: 1916, rpm33: 3952 }

const PROCEDURES = {
  soc: ['Levar o carro ao box.', 'Apertar o E-STOP.', 'Conectar o carregador 15S.', 'Registrar o estado de carga na sessão.'],
  voltage: ['Apertar o E-STOP.', 'Medir a tensão do pack com multímetro.', 'Conferir conexões e fusível.', 'Religar só com a tensão entre 45 V e 54,75 V.'],
  current: ['Apertar o E-STOP.', 'Conferir fusível de 15 A e estado do BMS.', 'Girar a roda à mão e verificar arrasto.', 'Conferir o limite de corrente do inversor.'],
  speed: ['Parar o carro.', 'Conferir o sensor Hall da roda.', 'Comparar com a velocidade do GNSS.', 'Conferir os freios.'],
  battery: ['Apertar o E-STOP.', 'Afastar a equipe do pack.', 'Medir o pack com termômetro externo.', 'Religar só abaixo de 45 °C e com a causa registrada.'],
  motor: ['Apertar o E-STOP e aguardar o elo CC descarregar.', 'Medir a carcaça do motor com termômetro externo.', 'Com a carcaça fria, conferir a sonda DS18B20 e o 1-Wire.', 'Com a carcaça quente, conferir fixação, fluxo de ar e atrito.', 'Registrar a causa e religar só abaixo de 90 °C.'],
  inverter: ['Apertar o E-STOP.', 'Conferir ventilação e fixação do inversor.', 'Conferir o sensor de temperatura.', 'Religar só abaixo de 70 °C.'],
  data: ['Conferir sensores e cabos do nó.', 'Reiniciar a aquisição.', 'Confirmar leituras válidas antes de sair.'],
  comm: ['Conferir a rede e o computador de bordo.', 'Reiniciar a aquisição.', 'Confirmar que as amostras voltaram.'],
  storage: ['Conferir o banco de dados.', 'Confirmar que o histórico voltou a gravar.'],
  broker: ['Conferir o broker MQTT.', 'Aguardar a reconexão.', 'Confirmar que as amostras voltaram.'],
}

const row = (code, severity, when, message, pilot, pilotNote, mechanic, box, group, signal) => ({
  code, severity, when, message, pilot, pilotNote, mechanic, box, group, signal,
})

export const ALERTS = [
  row('W-SOC-LOW', 'warning', 'Carga em até 30 %', 'Estado de carga baixo', 'MANTENHA A FAIXA', 'carga baixa', 'Conferir carga antes da próxima saída', 'Observar o estado de carga', 'soc', 'soc'),
  row('E-SOC-CRITICAL', 'error', 'Carga em até 15 %', 'Estado de carga crítico', 'VÁ AO BOX', 'carga crítica', 'Apertar o E-STOP e levar à carga', 'Separar o carregador', 'soc', 'soc'),
  row('W-VDC-RANGE', 'warning', 'Até 45 V ou acima de 54,75 V', 'Tensão DC fora da faixa de operação da bateria', 'MANTENHA A FAIXA', 'tensão anormal', 'Conferir tensão do pack e conexões', 'Observar a tensão DC', 'voltage', 'vdc'),
  row('E-VDC-RANGE', 'error', 'Até 37,5 V ou a partir de 60 V', 'Tensão DC fora do limite da bateria', 'SOLTE E PARE', 'tensão no limite', 'Apertar o E-STOP e medir o pack', 'Ir até o carro', 'voltage', 'vdc'),
  row('W-IDC-HIGH', 'warning', 'Corrente a partir de 10 A', 'Corrente DC no limite do inversor', 'SOLTE', 'corrente alta', 'Conferir limite do inversor e arrasto', 'Observar a corrente DC', 'current', 'idc'),
  row('E-IDC-OVERCURRENT', 'error', 'Corrente a partir de 12 A', 'Corrente DC no limite de corte do BMS', 'SOLTE E PARE', 'corrente no corte', 'Apertar o E-STOP, conferir fusível e BMS', 'Ir até o carro', 'current', 'idc'),
  row('W-SPEED-HIGH', 'warning', 'A partir de 40 km/h', 'Velocidade elevada', 'SOLTE', 'velocidade alta', 'Conferir o sensor de velocidade', 'Observar a velocidade', 'speed', 'velocity'),
  row('E-SPEED-CRITICAL', 'error', 'A partir de 45 km/h', 'Velocidade crítica', 'SOLTE E FREIE', 'velocidade crítica', 'Conferir Hall da roda e freios', 'Confirmar com o piloto na parada', 'speed', 'velocity'),
  row('W-BATT-TEMP', 'warning', 'Bateria a partir de 45 °C', 'Temperatura da bateria elevada', 'VÁ AO BOX', 'bateria quente', 'Medir o pack e aguardar esfriar', 'Separar o termômetro', 'battery', 'battery_temp'),
  row('E-BATT-OVERTEMP', 'error', 'Bateria a partir de 60 °C', 'Bateria acima do limite de descarga do LiFePO4', 'PARE COM SEGURANÇA', 'bateria no limite', 'Apertar o E-STOP e afastar a equipe', 'Acionar o procedimento de bateria', 'battery', 'battery_temp'),
  row('W-MOTOR-TEMP', 'warning', 'Carcaça a partir de 90 °C', 'Temperatura do motor elevada', 'VÁ AO BOX', 'mantenha roda livre', 'Medir a carcaça, conferir sonda e dissipação', 'Separar o termômetro', 'motor', 'motor_temp'),
  row('E-MOTOR-OVERTEMP', 'error', 'Carcaça a partir de 110 °C', 'Sobretemperatura no motor', 'SOLTE E PARE', 'motor no limite', 'Apertar o E-STOP e aguardar esfriar', 'Ir até o carro', 'motor', 'motor_temp'),
  row('W-CTRL-TEMP', 'warning', 'Inversor a partir de 70 °C', 'Temperatura do controlador elevada', 'VÁ AO BOX', 'inversor quente', 'Conferir ventilação e fixação do inversor', 'Separar o termômetro', 'inverter', 'controller_temp'),
  row('E-CTRL-OVERTEMP', 'error', 'Inversor a partir de 85 °C', 'Sobretemperatura no controlador', 'SOLTE E PARE', 'inversor no limite', 'Apertar o E-STOP e aguardar esfriar', 'Ir até o carro', 'inverter', 'controller_temp'),
  row('E-DATA-INVALID', 'error', 'Leitura NaN ou infinita', 'Leitura inválida no processamento', 'SEM DADOS', 'mantenha o ritmo', 'Conferir sensores e cabos do nó', 'Não confiar nos valores da tela', 'data', null),
  row('E-COMM-STALE', 'error', '3 s sem amostra na API', 'Telemetria interrompida', 'SEM DADOS', 'mantenha o ritmo', 'Conferir rede e computador de bordo', 'Confirmar o carro visualmente', 'comm', null),
  row('E-PERSIST', 'error', 'Falha ao gravar no banco', 'Falha ao gravar a amostra no banco', null, null, 'Sem ação', 'Corrigir o banco. O histórico parou de gravar', 'storage', null),
  row('E-MQTT', 'error', 'API ou processamento sem broker, em até 7,5 s', 'Falha de comunicação com o broker MQTT', null, null, 'Conferir o broker MQTT', 'Confirmar o carro visualmente', 'broker', null),
]

export const ALERT_BY_CODE = Object.fromEntries(ALERTS.map((a) => [a.code, a]))
export const procedureFor = (alert) => PROCEDURES[alert?.group] ?? []

export const FAULTS = [
  { id: 'motor_hot', label: 'Motor quente', effect: 'Temperatura sobe até o aviso e o corte', signal: 'motor_temp' },
  { id: 'overcurrent', label: 'Sobrecorrente', effect: 'Corrente sobe até 10 A e 12 A', signal: 'idc' },
  { id: 'low_voltage', label: 'Tensão baixa', effect: 'Tensão cai até 45 V e 37,5 V', signal: 'vdc' },
  { id: 'battery_hot', label: 'Bateria quente', effect: 'Temperatura sobe até 45 °C e 60 °C', signal: 'battery_temp' },
  { id: 'inverter_hot', label: 'Inversor quente', effect: 'Temperatura sobe até 70 °C e 85 °C', signal: 'controller_temp' },
  { id: 'telemetry_loss', label: 'Perda de telemetria', effect: 'A aquisição para de publicar', signal: null },
]

export const FAULT_RAMPS = {
  motor_hot: { motor_temp: [[0, 45], [12, 92], [24, 112]] },
  overcurrent: { vdc: [[0, 49.5]], idc: [[0, 8], [8, 10.2], [16, 12.4]] },
  low_voltage: { vdc: [[0, 47], [10, 44.8], [20, 37.2]], idc: [[0, 3]] },
  battery_hot: { battery_temp: [[0, 35], [10, 47], [20, 62]] },
  inverter_hot: { controller_temp: [[0, 40], [10, 72], [20, 87]] },
  telemetry_loss: {},
}

export const FAULT_MAX_S = 180

export const EFFICIENCY_CASES = [
  { name: 'Ciclo de referência', value: '503,61', short: '503,61', condition: 'Regime periódico de 16 a 33 km/h, com 48 V fixos.', distance: '0,97 km', time: '2,4 min', speed: '24,2 km/h', whKm: '1,99', peak: '7,18 A', check: 'Estudo e gêmeo, mesmo resultado', note: 'Não inclui a partida do repouso.' },
  { name: 'Uma hora', value: '497,89', short: '497,9', condition: 'Partida do repouso e carga variável, de 16 a 33 km/h.', distance: '24,08 km', time: '60,0 min', speed: '24,1 km/h', whKm: '2,01', peak: '7,42 A', check: 'Reproduzido no código 3e0f1a4' },
  { name: 'Tentativa de 8,53 km', value: '480,40', short: '480,4', condition: '10 voltas com partida do repouso, de 16 a 33 km/h.', distance: '8,53 km', time: '21,3 min', speed: '24,0 km/h', whKm: '2,08', peak: '7,31 A', check: 'Reproduzido no código 3e0f1a4', note: 'Inclui a partida do repouso em uma distância curta.' },
  { name: 'Faixa robusta', value: '475,09', short: '475,1', condition: '10 voltas de 23,2 a 27,7 km/h, com pulsos mais longos.', distance: '8,53 km', time: '20,4 min', speed: '25,1 km/h', whKm: '2,10', peak: '6,13 A', check: 'Reproduzido no código 3e0f1a4', note: 'Na tentativa de 8,53 km, o resultado é menor que o da faixa de 16 a 33 km/h.' },
]

export const MODEL_PARAMETERS = [
  ['Massa com piloto', '140 kg'], ['Rolamento, Cr', '0,003'], ['Área de arrasto, CdA', '0,050 m²'],
  ['Bateria 15S', '6 Ah · 288 Wh'], ['Relação', '16/149'], ['Torque', '0,75 N·m'],
]

export const SIGNALS = [
  ['Energia', 'Tensão e corrente DC', 'vdc, idc', 'INA228 com shunt de 7,5 mΩ', 'Modbus, nó 1', 'contract'],
  ['Energia', 'Corrente redundante', 'idc_aux', 'ACS758 com ADS1115', 'Modbus, nó 1', 'pending', 'Mapeado, hardware pendente'],
  ['Energia', 'Energia e km/kWh', 'energy_wh, km_per_kwh', 'Integração de vdc × idc', 'Processamento', 'computed'],
  ['Segurança', 'Elo CC energizado', 'dc_link_on', 'Optoacoplador 4N25', 'Modbus, nó 1', 'simulated'],
  ['Segurança', 'Emergência, BMS-OK, homem-morto', 'inv_inputs', 'Entradas cabeadas do inversor', 'Modbus, nó 2', 'simulated'],
  ['Inversor', 'Estado e código de falha', 'inv_state, inv_fault', 'Firmware STM32G431', 'Modbus, nó 2', 'simulated'],
  ['Motor', 'Rotação', 'motor_rpm', 'Sensores Hall do motor', 'Modbus, nó 2', 'contract'],
  ['Motor', 'Torque e rendimento', 'motor_torque, motor_efficiency', 'Modelo do gêmeo digital', 'Processamento', 'computed'],
  ['Bateria', 'Célula mín, média e máx', 'cell_voltage_*', 'BMS com interface de dados', 'Modbus, nó 3', 'contract'],
  ['Bateria', 'Tensão de cada célula', 'cell_v[15] (novo)', 'Depende do BMS escolhido', 'Modbus, nó 3', 'pending', 'Depende do BMS'],
  ['Térmica', 'Bateria e motor', 'battery_temp, motor_temp', 'DS18B20 U17 e U16, 1-Wire', 'Modbus, nó 1', 'contract'],
  ['Térmica', 'Inversor', 'controller_temp', 'Sensor de temperatura do inversor', 'Modbus, nó 2', 'contract'],
  ['Térmica', 'Temperatura esperada do motor', 'motor_temp_model', 'Modelo térmico do gêmeo', 'Processamento', 'computed'],
  ['Veículo', 'Velocidade e aceleração', 'velocity, acceleration', 'Hall da roda e MPU-6050', 'Modbus, nó 1', 'contract'],
  ['Veículo', 'Posição GNSS', 'lat, lon, gps_sats, gps_hdop', 'Módulo GPS', 'Modbus, nó 1', 'contract'],
  ['Rede', 'Idade e erros do barramento', 'bus_age_ms, bus_errors', 'Mestre Modbus', 'Computador de bordo', 'simulated'],
  ['Rede', 'Saúde de cada nó', '/api/bus/health', 'Mestre Modbus', 'Computador de bordo', 'pending', 'Emulado, hardware pendente'],
  ['Rádio', 'RSSI, SNR e quadros perdidos', '/api/lora/link', 'Receptor LoRa do box', 'Ponte USB do box', 'pending', 'Emulado, hardware pendente'],
  ['Isolação', 'Resistência de isolação', 'não existe', 'Sem monitor no esquemático', 'Sem caminho', 'none', 'Sem sensor'],
]

export const SIGNAL_STATUS = { contract: 'No contrato', computed: 'Calculado', simulated: 'Simulado, hardware pendente', pending: 'A criar ou definir', none: 'Sem sensor' }

export const INVERTER_STATES = { precharge: 'pré-carga', wait_dead_man: 'aguardando homem-morto', ready: 'liberado', run: 'em operação', fault: 'falha' }

export const DATA_PATH = [
  ['Nós de aquisição', 'ESP32-S3, amostragem de 10 Hz'],
  ['RS485 · Modbus RTU', 'Mestre consulta os nós 1, 2 e 3'],
  ['Computador de bordo', 'Publica no MQTT'],
  ['Processamento', 'Gêmeo digital e regras de alerta'],
  ['TimescaleDB', 'Histórico por sessão'],
  ['API e WebSocket', 'Alimentam estas telas'],
  ['AAS sobre OPC UA', 'Integração com a indústria'],
  ['LoRa 915 MHz', 'Resumo para o box'],
]
