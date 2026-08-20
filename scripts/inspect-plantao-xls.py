from pathlib import Path
import json
import pandas as pd

source = Path('/home/ubuntu/upload/Relatorio-PlantaoCOSI(1).xls')
output = Path('/home/ubuntu/Escala-ICI/docs/validation/plantao-xls-inspection.json')

book = pd.ExcelFile(source, engine='xlrd')
result = {'source': str(source), 'sheets': []}
for sheet in book.sheet_names:
    frame = pd.read_excel(source, sheet_name=sheet, header=None, engine='xlrd')
    result['sheets'].append({
        'name': sheet,
        'rows': int(frame.shape[0]),
        'columns': int(frame.shape[1]),
        'values': [[None if pd.isna(value) else str(value) for value in row] for row in frame.values.tolist()],
    })
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
