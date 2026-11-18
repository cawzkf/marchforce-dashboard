# Changelog

## v2.0.3

- Os rótulos seguem `data_source` enviado pelo backend: `DADOS SIMULADOS`, `DADOS MEDIDOS`, `DADOS EMULADOS` ou `origem indisponível`.
- Com barramento ou bancada, valores fora de `measured_fields` aparecem como `(modelo)`.
- Box usa a origem declarada em cada quadro LoRa.
- Falha ao vivo fica disponível apenas com amostras do simulador.
- Requer a branch `feat/telemetry-integration` do gêmeo.

## v2.0.2

- Box: estado do enlace, RSSI, SNR, quadros perdidos e erros de CRC, vindos de `/api/lora/link`.
- Sinais: saúde dos nós 1, 2 e 3 com estado, idade e erros, vinda de `/api/bus/health`.
- Sem dado recente, esses campos mostram "indisponível".
- Demo local: enlace e nós com valores emulados, sem backend.
- Requer a branch `feat/telemetry-integration` do gêmeo.

## v2.0.1

- Operação e Piloto: o valor passa a se chamar km/kWh parcial, com aviso de oscilação pela fase do ciclo.
- km/kWh fica indisponível em sessão retomada em movimento ou com amostras perdidas.
- Mecânica: sequência de partida com `AGUARDE`, `PEÇA O HOMEM-MORTO` e `PODE LARGAR`, e alerta sem repetir a ordem.
- Operação: entradas do inversor e elo CC vindos de `inv_inputs` e `dc_link_on`.
- Diagnóstico: "Até o corte" mostra "corte atingido" depois do limite.
- Requer o contrato da branch `feat/sim-fault-injection` do gêmeo.

## v2.0.0

- Telas de operação, diagnóstico, sinais, casos de eficiência, casos de alerta e displays.
- Falha ao vivo, box com mapa e quadros LoRa, fonte de bancada e demo local.
