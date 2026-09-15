function instalarMenuCentralPersistente(){
  const ss=niceMaster_();
  ScriptApp.getProjectTriggers().forEach(t=>{if(t.getHandlerFunction()==='niceCertCentralMenu_')ScriptApp.deleteTrigger(t)});
  ScriptApp.newTrigger('niceCertCentralMenu_').forSpreadsheet(ss).onOpen().create();
  niceCertCentralMenu_();
  SpreadsheetApp.getUi().alert('Menu NICE • Certificados Central instalado.');
}
