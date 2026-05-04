# backend/worker/workflow.py
def close_incident(work_item, rca_data):
    # Requirement 3.2: Mandatory RCA validation
    if not rca_data or not rca_data.get("root_cause"):
        raise Exception("RCA mandatory for closing incident")[cite: 1]
    
    work_item.status = "CLOSED"
    work_item.end_time = datetime.utcnow()
    
    # Requirement 3.3: MTTR Calculation (End - Start)
    mttr = work_item.end_time - work_item.start_time
    work_item.mttr_seconds = mttr.total_seconds()[cite: 1]
    
    return work_item
