interface String {
    replaceTemplateVariable(name: string, value: any) : string;
}

String.prototype.replaceTemplateVariable = function(name: string, value: any) {
    const regexp = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'ig');
    return this.replace(regexp, value);
}