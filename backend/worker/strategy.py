# backend/worker/strategy.py
from abc import ABC, abstractmethod

class AlertingStrategy(ABC):
    @abstractmethod
    def get_severity(self): pass

class RDBMSFailureStrategy(AlertingStrategy):
    def get_severity(self): return "P0" # High Priority

class CacheFailureStrategy(AlertingStrategy):
    def get_severity(self): return "P2" # Lower Priority

def determine_severity(component_id: str):
    if "RDBMS" in component_id:
        return RDBMSFailureStrategy().get_severity()
    return CacheFailureStrategy().get_severity()
