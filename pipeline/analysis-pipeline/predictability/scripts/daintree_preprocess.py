columns_to_drop = ['SequencingID', 'ModelConditionID', 'IsDefaultEntryForModel',
       'IsDefaultEntryForMC']

def index_by_model(df):
    if 'IsDefaultEntryForModel' in df:
        print("Detected matrix which needs filtering to ModelID")
        df = df[df['IsDefaultEntryForModel'] == 'Yes']
        df = df.set_index('ModelID')
        df = df.drop(columns=columns_to_drop).copy()
    return (df)
